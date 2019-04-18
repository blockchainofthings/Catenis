#!/bin/bash

# Script used to backup 'meteor' database used in Catenis development environment into `./mongodb_dump/<current_date>` directory.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null && pwd)"

d="$SCRIPT_DIR/mongodb_dump"; t=`date +%C%y-%m-%d`; if [ -d $d/$t ]; then echo "A database backup of $t (output dir $d/$t) already exists"; else mongodump --uri=mongodb://127.0.0.1:3001/meteor --out="$d/$t"; fi;
