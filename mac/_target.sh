# Közös: Autosweb célmappa (magyar Mac: Letöltések)
# shellcheck shell=bash

autosweb_letoltes_root() {
  if [ -d "${HOME}/Letöltések" ]; then
    echo "${HOME}/Letöltések"
  elif [ -d "${HOME}/Downloads" ]; then
    echo "${HOME}/Downloads"
  else
    mkdir -p "${HOME}/Letöltések"
    echo "${HOME}/Letöltések"
  fi
}

autosweb_target() {
  local root
  root="$(autosweb_letoltes_root)"
  # Ha már létezik a másik néven, azt használjuk (régi telepítés).
  if [ -d "${root}/autosweb" ]; then
    echo "${root}/autosweb"
    return
  fi
  if [ -d "${HOME}/Downloads/autosweb" ] && [ "${root}" != "${HOME}/Downloads" ]; then
    echo "${HOME}/Downloads/autosweb"
    return
  fi
  if [ -d "${HOME}/Letöltések/autosweb" ]; then
    echo "${HOME}/Letöltések/autosweb"
    return
  fi
  echo "${root}/autosweb"
}
