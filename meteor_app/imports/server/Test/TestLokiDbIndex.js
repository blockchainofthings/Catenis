import Loki from 'lokijs';

export function TestLokiDbIndex() {
    // Create database with two indices, one on a boolean property
    this.db = new Loki();
    this.coll = this.db.addCollection('TestCollection', {
        indices: [
            'allocated'
        ]
    });

    // Insert test rows
    [{
        "amount": 8000
    }, {
        "amount": 6000
    }, {
        "amount": 4000
    }, {
        "amount": 2000
    }].forEach((row) => {
        this.coll.insert({
            amount: row.amount,
            allocated: false
        });
    });
}

TestLokiDbIndex.prototype.allocateRows = function (amounts, fixIndex = false) {
    amounts = !Array.isArray(amounts) ? [amounts] : amounts;

    const foundDocs = this.coll.find({amount: {$in: amounts}});

    if (foundDocs.length > 0) {
        foundDocs.forEach((doc) => {
            doc.allocated = true;
        });

        this.coll.update(foundDocs);
    }

    if (fixIndex) {
        this.coll.ensureIndex('allocated', true);
    }
};

TestLokiDbIndex.prototype.getAlloctedRows = function () {
    return this.coll.find({allocated: true});
};

TestLokiDbIndex.prototype.getUnalloctedRows = function () {
    return this.coll.find({allocated: false});
};

TestLokiDbIndex.prototype.clearAllocatedRows = function () {
    const allocatedDocs = this.coll.find({allocated: true});

    if (allocatedDocs.length > 0) {
        allocatedDocs.forEach((doc) => {
            doc.allocated = false;
        });

        this.coll.update(allocatedDocs);
    }
};

TestLokiDbIndex.runTest = function (fixIndex = false) {
    const test = new TestLokiDbIndex();

    test.allocateRows([8000, 6000], fixIndex);

    let numAllocRows = test.getAlloctedRows().length;
    let numUnallocRows = test.getUnalloctedRows().length;

    assert(numAllocRows === 2, '[1] - Number of allocated rows different than expected. Current value:', numAllocRows, ', expected value: 2');
    assert(numUnallocRows === 2, '[1] - Number of unallocated rows different than expected. Current value:', numUnallocRows, ', expected value: 2');

    test.clearAllocatedRows();

    numAllocRows = test.getAlloctedRows().length;
    numUnallocRows = test.getUnalloctedRows().length;

    assert(numAllocRows === 0, '[2] - Number of allocated rows different than expected. Current value:', numAllocRows, ', expected value: 0');
    assert(numUnallocRows === 4, '[2] - Number of unallocated rows different than expected. Current value:', numUnallocRows, ', expected value: 4');

    test.allocateRows([8000, 2000], fixIndex);

    numAllocRows = test.getAlloctedRows().length;
    numUnallocRows = test.getUnalloctedRows().length;

    assert(numAllocRows === 2, '[3] - Number of allocated rows different than expected. Current value:', numAllocRows, ', expected value: 2');
    assert(numUnallocRows === 2, '[3] - Number of unallocated rows different than expected. Current value:', numUnallocRows, ', expected value: 2');

    test.clearAllocatedRows();
    
    numAllocRows = test.getAlloctedRows().length;
    numUnallocRows = test.getUnalloctedRows().length;

    assert(numAllocRows === 0, '[4] - Number of allocated rows different than expected. Current value:', numAllocRows, ', expected value: 0');
    assert(numUnallocRows === 4, '[4] - Number of unallocated rows different than expected. Current value:', numUnallocRows, ', expected value: 4');
};

function assert(cond, msg) {
    if (!cond) {
        console.log.apply(this, Array.from(arguments).splice(1));
    }
}