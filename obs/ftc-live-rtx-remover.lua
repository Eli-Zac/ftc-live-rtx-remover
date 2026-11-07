-- FTC Live RTX Remover for OBS
-- Adds CSS to every browser source that points at an FTC Live server (any IP),
-- cropping the "PRESENTED BY RTX" strip off the season logos.
-- Install: OBS > Tools > Scripts > + > select this file.

obs = obslua

local MARK = "/* FTC Live RTX remover */"
local CSS = MARK .. [[

img[src*="_primary_word"]{aspect-ratio:373/72 !important;object-fit:cover !important;object-position:top !important}
img[src*="/ftc/2025/color"]{aspect-ratio:649/593 !important;object-fit:cover !important;object-position:top !important}
img[src*="/ftc/2026/color"]{aspect-ratio:234/315 !important;object-fit:cover !important;object-position:top !important}
]]

-- FTC Live pages live under http://<host>/event/<code>/...
local function is_ftc_live(url)
  return url ~= nil and url:match("^https?://[^/]+/event/[^/?#]+") ~= nil
end

local function patch_source(src)
  if obs.obs_source_get_unversioned_id(src) ~= "browser_source" then return 0 end
  local s = obs.obs_source_get_settings(src)
  local patched = 0
  if not obs.obs_data_get_bool(s, "is_local_file") then
    local url = obs.obs_data_get_string(s, "url")
    local css = obs.obs_data_get_string(s, "css")
    if is_ftc_live(url) and not css:find(MARK, 1, true) then
      obs.obs_data_set_string(s, "css", css .. "\n" .. CSS)
      obs.obs_source_update(src, s)
      patched = 1
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
    "showing an FTC Live page (any server IP). New sources are picked up within a second."
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
