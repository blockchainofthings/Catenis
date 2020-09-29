#!/bin/bash
# Script used to send input parameters to Catenis (via Unix domain socket previously open by Catenis)
#
# How to use it:
#  . any parameters to be passed should be preceded by '--'
#  . if no password parameter is passed (-p <psw>) the script will ask for a password to be entered

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null && pwd)"
APP_DIR="$SCRIPT_DIR/.."

cd "$APP_DIR"

# Filter internal (before '--') and external (after '--') parameters
idx=0
delimiterFound=0
hasPswOption=0

for arg; do
  if [ $delimiterFound -eq 1 ]; then
    # Save external parameter (to be passed to Catenis)
    extParams[idx]="$arg"

    if [[ $arg == "-p" || $arg == "--password" ]]; then
      hasPswOption=1
    fi
  else
    if [ $arg == "--" ]; then
      delimiterFound=1
    else
      # Save internal parameter (to be interpreted by this script)
      intParams[idx]="$arg"
    fi
  fi

  ((idx++))
done

if [ $hasPswOption -ne 1 ]; then
  # Request user to enter password (to be passed to Catenis)
  echo -n "Enter password: "
  read -s psw
  echo

  # Add password to external parameters
  extParams[idx]="-p"
  ((idx++))
  extParams[idx]="$psw"
fi

# Wait for Unix domain socket used to input parameters to be created (by Catenis)
tmout=60

while [ ! -S ./inputparams ]; do
  if [ $tmout -eq 0 ]; then
    echo "Timeout waiting for input parameters socket"
    exit -1
  fi
  sleep 1
  ((tmout--))
done

extParamsList=""

for param in "${extParams[@]}"; do
  extParamsList="$extParamsList '$param'"
done

# Send external parameters to Catenis (through open Unix domain socket)
echo -n "$extParamsList" | nc -U ./inputparams