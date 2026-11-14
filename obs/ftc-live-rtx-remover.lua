-- FTC Live RTX Remover for OBS
-- Adds CSS to every browser source that points at an FTC Live server (any IP or hostname),
-- cropping the "PRESENTED BY RTX" strip off the season logos.
-- Install: OBS > Tools > Scripts > + > select this file.

obs = obslua

local MARK = "/* FTC Live RTX remover */"
local CSS = MARK .. [[

img[src*="_primary_word"]{aspect-ratio:373/72 !important;object-fit:cover !important;object-position:top !important}
img[src*="_primary_wide"]{aspect-ratio:383/69.2 !important;object-fit:cover !important;object-position:left !important}
img[src*="_season_primary_color"],img[src*="/ftc/2027/color"]{aspect-ratio:414/234 !important;object-fit:cover !important;object-position:top !important}
img[src*="/ftc/2025/color"]{aspect-ratio:649/593 !important;object-fit:cover !important;object-position:top !important}
img[src*="/ftc/2026/color"]{aspect-ratio:234/315 !important;object-fit:cover !important;object-position:top !important}
]]

-- FTC Live pages live under http://<host>/event/<code>/...
local function is_ftc_live(url)
  return url ~= nil and url:match("^https?://[^/]+/event/[^/?#]+") ~= nil
end

-- Returns the source's CSS with our block (re)applied, or nil if it is already current.
local function patched_css(css)
  local start = css:find(MARK, 1, true)
  local base = css
  if start ~= nil then
    -- Our block is always appended last, so everything from the marker on is ours.
    if css:sub(start) == CSS then return nil end
    base = css:sub(1, start - 1):gsub("%s+$", "")
  end
  return base .. "\n" .. CSS
end

local function patch_source(src)
  if obs.obs_source_get_unversioned_id(src) ~= "browser_source" then return 0 end
  local s = obs.obs_source_get_settings(src)
  local patched = 0
  if not obs.obs_data_get_bool(s, "is_local_file") then
    local url = obs.obs_data_get_string(s, "url")
    if is_ftc_live(url) then
      local new_css = patched_css(obs.obs_data_get_string(s, "css"))
      if new_css ~= nil then
        obs.obs_data_set_string(s, "css", new_css)
        obs.obs_source_update(src, s)
        patched = 1
      end
    end
  end
  obs.obs_data_release(s)
  return patched
end

local function scan()
  local count = 0
  local sources = obs.obs_enum_sources()
  if sources ~= nil then
    for _, src in ipairs(sources) do
      count = count + patch_source(src)
    end
    obs.source_list_release(sources)
  end
  if count > 0 then
    obs.script_log(obs.LOG_INFO, "Removed RTX logo from " .. count .. " FTC Live browser source(s)")
  end
end

function script_description()
  return "<b>FTC Live RTX Remover</b><br>Automatically hides the RTX logo on any browser source " ..
    "showing an FTC Live page (any server IP or hostname). New sources are picked up within a second."
end

function script_properties()
  local props = obs.obs_properties_create()
  obs.obs_properties_add_button(props, "apply_now", "Apply now", function()
    scan()
    return false
  end)
  return props
end

function script_load(settings)
  scan()
  obs.timer_add(scan, 1000)
end

function script_unload()
  obs.timer_remove(scan)
end
