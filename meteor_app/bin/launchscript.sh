#!/bin/bash
# Script used to execute a separate process in the background
#
# How to use it:
#  . pass the name of the program/script to be executed along with any required parameters

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null && pwd)"
APP_DIR="$SCRIPT_DIR/.."

cd "$APP_DIR"

if [ -f ./nohup.out ]; then
  rm ./nohup.out
fi

nohup "$SCRIPT_DIR"/"$@" &