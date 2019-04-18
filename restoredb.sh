#!/bin/bash

# Script used to restore a backup of the 'Catenis' database (from `./mongodb_dump/CatenisDB/<date>` directory)
#  onto the 'meteor' database used in Catenis development environment

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null && pwd)"

if [ "$#" -ne 1 ]; then
    echo "Usage: restorectndb.sh <dump_date>"
    exit
fi

dumpDir="$SCRIPT_DIR/mongodb_dump/CatenisDB/$1"

if [[ ! -d $dumpDir ]]; then
    echo "Dump directory ($dumpDir) does not exist"
    exit
fi

echo "Trying to restore Catenis DB from $dumpDir"
read -p "Do you want to proceed? " -n 1 -r
echo    # (optional) move to a new line
if [[ $REPLY =~ ^[Yy]$ ]]; then
    mongorestore --uri=mongodb://127.0.0.1:3001/ --nsFrom='Catenis.$collection$' --nsTo='meteor.$collection$' $dumpDir
fi