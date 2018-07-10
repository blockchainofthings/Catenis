#!/bin/bash
d="./mongodb_dump"; t=`date +%C%y-%m-%d`; if [ -d $d/$t ]; then echo "A database backup of $t (output dir $d/$t) already exists"; else mongodump --uri=mongodb://127.0.0.1:3001/meteor --out="$d/$t"; fi;
