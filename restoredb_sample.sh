# Restore meteor DB onto Catenis DB
mongorestore --preserveUUID --uri=mongodb://localhost:27017/ --nsFrom='meteor.$collection$' --nsTo='Catenis.$collection$' mongodb_dump/<date_dir>
