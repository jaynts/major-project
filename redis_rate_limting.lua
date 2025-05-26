local redis = require "resty.redis"
local red = redis:new()

local BURST_SIZE = 100     
local FILL_RATE = 10       
local BAN_TIME = 3600      

local client_ip = ngx.var.remote_addr
local api_key = ngx.req.get_headers()["X-API-Key"] or "anonymous"
local client_id = "rate_limit:" .. client_ip .. ":" .. api_key

local ok, err = red:connect(redis_host, redis_port)
if not ok then
    ngx.log(ngx.ERR, "Redis connect failed: ", err)
    local dict = ngx.shared.rate_limit_cache
    local allow = dict:incr(client_id, -1, BURST_SIZE, 1/FILL_RATE)
    if allow == nil then
        ngx.header["X-RateLimit-Remaining"] = 0
        ngx.exit(429)
    end
    ngx.header["X-RateLimit-Remaining"] = allow
    return
end

local script = [[
    local key = KEYS[1]
    local burst = tonumber(ARGV[1])
    local fill_rate = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    local ban_time = tonumber(ARGV[4])

    -- Get current state
    local data = redis.call("HMGET", key, "tokens", "last_update", "banned")
    local tokens = tonumber(data[1]) or burst
    local last_update = tonumber(data[2]) or now
    local banned = data[3]

    -- Check if banned
    if banned then
        return {0, 0, 1}  -- remaining=0, reset=0, banned=1
    end

    -- Refill tokens
    local elapsed = now - last_update
    tokens = math.min(burst, tokens + (elapsed * fill_rate))

    -- Check limit
    if tokens >= 1 then
        tokens = tokens - 1
        redis.call("HMSET", key, 
            "tokens", tokens, 
            "last_update", now,
            "banned", "0")
        redis.call("EXPIRE", key, ban_time)
        return {tokens, now + (1/fill_rate), 0}
    else
        -- Auto-ban if tokens go negative (exceeds burst)
        if tokens < -burst then
            redis.call("HSET", key, "banned", "1")
            redis.call("EXPIRE", key, ban_time)
            return {0, 0, 1}
        end
        return {0, now + (1/fill_rate), 0}
    end
]]

local res, err = red:eval(script, 1, client_id, BURST_SIZE, FILL_RATE, ngx.now(), BAN_TIME)
if not res then
    ngx.log(ngx.ERR, "Redis eval failed: ", err)
    ngx.exit(500)
end

local remaining = res[1]
local reset_time = res[2]
local banned = res[3]

ngx.header["X-RateLimit-Limit"] = BURST_SIZE
ngx.header["X-RateLimit-Remaining"] = remaining
ngx.header["X-RateLimit-Reset"] = reset_time

if banned == 1 then
    ngx.header["Retry-After"] = BAN_TIME
    ngx.exit(403)
elseif remaining == 0 then
    ngx.header["Retry-After"] = reset_time - ngx.now()
    ngx.exit(429)
end



