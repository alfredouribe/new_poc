import log from '../../dxmodules/dxLogger.js'
import sqlite from '../../dxmodules/dxSqlite.js'

//-------------------------variable-------------------------
const sqliteService = {}
//-------------------------public-------------------------
// Initialize database
sqliteService.init = function (path) {
    if (!path) {
        throw new Error("path should not be null or empty")
    }
    // Create database
    sqlite.init(path)
    // Create tables
    createTables()
}
let entities = {
    d1_pass_record: {
        id: "VARCHAR(128) PRIMARY KEY",
        keyId: "VARCHAR(128)",
        permissionId: "VARCHAR(128)",
        userId: "VARCHAR(128)",
        type: "VARCHAR(128)",
        code: "VARCHAR(128)",
        door: "VARCHAR(128)",
        time: "INTEGER",
        result: "INTEGER",
        extra: "TEXT",
        message: "TEXT",
    },
    d1_permission: {
        permissionId: "VARCHAR(128) PRIMARY KEY",
        userId: "VARCHAR(128)",
        door: "VARCHAR(128)",
        extra: "TEXT",
        timeType: "INTEGER",
        beginTime: "INTEGER",
        endTime: "INTEGER",
        repeatBeginTime: "INTEGER",
        repeatEndTime: "INTEGER",
        period: "TEXT",
    },
    d1_security: {
        securityId: "VARCHAR(128) PRIMARY KEY",
        type: "VARCHAR(128)",
        key: "VARCHAR(128)",
        value: "TEXT",
        startTime: "INTEGER",
        endTime: "INTEGER",
    },
    d1_voucher: {
        keyId: "VARCHAR(128) PRIMARY KEY",
        type: "VARCHAR(128)",
        code: "TEXT",
        userId: "VARCHAR(128)",
        extra: "TEXT",
    },
    d1_person: {
        userId: "VARCHAR(128) PRIMARY KEY",
        name: "VARCHAR(128)",
        extra: "TEXT",
    }
}

let sqlType2jsType = (sqlType) => {
    if (sqlType.indexOf("INTEGER") > -1) {
        return 'number'
    } else {
        return 'string'
    }
}

// Create tables
function createTables() {
    for (const tableName in entities) {
        const table = entities[tableName];
        let sql = `CREATE TABLE IF NOT EXISTS ${tableName} (`
        for (const column in table) {
            const type = table[column];
            sql += ` ${column} ${type},`
        }
        sql = sql.slice(0, -1);
        sql += ")"
        let ret = sqlite.exec(sql)
        if (ret != 0) {
            throw new Error(`table ${tableName} create exception: ${ret}`)
        }
    }
}
// Create JPA auto-generation for CRUD methods
let handler = {
    get: function (target, prop, receiver) {
        return (...args) => {
            return createJPA(prop, target.tableName, ...args)
        }
    }
}
sqliteService.d1_pass_record = new Proxy({ tableName: "d1_pass_record" }, handler);
sqliteService.d1_permission = new Proxy({ tableName: "d1_permission" }, handler);
sqliteService.d1_security = new Proxy({ tableName: "d1_security" }, handler);
sqliteService.d1_voucher = new Proxy({ tableName: "d1_voucher" }, handler);
sqliteService.d1_person = new Proxy({ tableName: "d1_person" }, handler);

// Start transaction. If the transaction is not committed, data will be restored after database restart.
// Therefore, commit must be executed after transaction.
// However, if another BEGIN TRANSACTION is executed while one transaction has not yet been committed or rolled back,
// SQLite automatically nests the new transaction inside the previous one, rather than overwriting the previous one.
sqliteService.transaction = function () {
    sqlite.exec("BEGIN TRANSACTION;")
}

// Rollback transaction
sqliteService.rollback = function () {
    sqlite.exec("ROLLBACK;")
}

// Commit transaction. It cannot be rolled back, and data cannot be restored.
sqliteService.commit = function () {
    sqlite.exec("COMMIT;")
}

/**
 * Automatically create common JPA CRUD SQL methods.
 * Supported rules: findByAAndBAndC, findAll, findAllOrderByADescBAsc, deleteByAAndBAndC, deleteAll, deleteInBatch, deleteByIdInBatch, updateAByBAndCAndD, save, saveAll, count, countBy
 * Conditional paginated query, e.g.: findByAAndBAndC(x,x,x,{ page: 0, size: 200, other conditions, id:"123456" })
 * Batch delete, e.g.: deleteInBatch([{ a: 1, b: 2, c: "3" }, { a: 2 }])
 * Conditional delete, e.g.: deleteAll({ a: 1, b: 2, c: "3" })
 * Single condition batch delete, e.g.: deleteByIdInBatch([1,2,3,4,5,6])
 * More examples can be found in the test method below.
 * @param {string} methodName Method name
 * @param {string} tableName Table name
 * @param  {...any} nums Method parameters
 * @returns sqlite execution result
 */
function createJPA(methodName, tableName, ...nums) {
    let sql
    let isFind = false
    let isCount = false
    let noPageable = false
    let hasOrderBy = false
    if (methodName.startsWith("save")) {
        // Create
        if (methodName.startsWith("saveAll")) {
            // Batch
            nums = nums[0]
            sql = `INSERT INTO ${tableName} VALUES `
            for (let i = 0; i < nums.length; i++) {
                const record = nums[i];
                sql += `(`
                for (const column in entities[tableName]) {
                    const item = record[column];
                    if (sqlType2jsType(entities[tableName][column]) == 'string') {
                        sql += `'${isEmpty(item) ? "" : item}',`
                    } else {
                        sql += `${isEmpty(item) ? 0 : item},`
                    }
                }
                sql = sql.slice(0, -1);
                sql += `)`
                if (i != nums.length - 1) {
                    sql += `, `
                }
            }
        } else {
            // Single
            let record = nums[0]
            sql = `INSERT INTO ${tableName} VALUES (`
            for (const column in entities[tableName]) {
                const item = record[column];
                if (sqlType2jsType(entities[tableName][column]) == 'string') {
                    sql += `'${isEmpty(item) ? "" : item}',`
                } else {
                    sql += `${isEmpty(item) ? 0 : item},`
                }
            }
            sql = sql.slice(0, -1);
            sql += `)`
        }
        methodName = ""
        noPageable = true
    } else if (methodName.startsWith("delete")) {
        // Delete
        if (methodName.startsWith("deleteAll")) {
            // Clear table
            sql = `DELETE FROM ${tableName} `
            methodName = ""
        } else if (methodName.endsWith("InBatch")) {
            if (nums.length != 1) {
                log.error("[JPA]:", "Missing parameters")
                return
            }
            sql = `DELETE FROM ${tableName} WHERE `
            if (methodName.indexOf("By") > -1) {
                methodName = methodName.split("By")[1].split("InBatch")[0]
                sql += `${firstLower(methodName)} IN `
                let whereClauses = ""
                for (let i = 0; i < nums[0].length; i++) {
                    const value = nums[0][i];
                    if (typeof value == 'string') {
                        whereClauses += `'${value}'`
                    } else {
                        whereClauses += `${value} `
                    }
                    if (i != nums[0].length - 1) {
                        whereClauses += ","
                    }
                }
                sql += `(${whereClauses})`
            } else {
                for (let i = 0; i < nums[0].length; i++) {
                    let whereClauses = ""
                    const record = nums[0][i];
                    for (const column in record) {
                        const value = record[column];
                        if (typeof value == 'string') {
                            whereClauses += `${column} = '${value}'`
                        } else {
                            whereClauses += `${column} = ${value}`
                        }
                        whereClauses += ` AND `
                    }
                    whereClauses = whereClauses.slice(0, " AND ".length * (-1))
                    sql += `(${whereClauses})`
                    if (i != nums[0].length - 1) {
                        sql += ` OR `
                    }
                }
            }
            methodName = ""
            noPageable = true
        } else {
            sql = `DELETE FROM ${tableName} `
            methodName = methodName.substring("delete".length)
        }
    } else if (methodName.startsWith("update")) {
        // Update
        sql = `UPDATE ${tableName} SET`
        methodName = methodName.substring("update".length)
    } else if (methodName.startsWith("find")) {
        // Query
        isFind = true
        sql = `SELECT * FROM ${tableName} `
        if (methodName.startsWith("findAll")) {
            methodName = methodName.substring("findAll".length)
        } else {
            methodName = methodName.substring("find".length)
        }
        let index = methodName.indexOf("OrderBy")
        if (index > -1) {
            hasOrderBy = methodName.substring(index + "OrderBy".length).match(/\w+?(Desc|Asc)/g)
            methodName = methodName.substring(0, index)
        }
    } else if (methodName.startsWith("count")) {
        // Aggregate (Count)
        isFind = true
        isCount = true
        sql = `SELECT COUNT(*) FROM ${tableName} `
        methodName = methodName.substring("count".length)
    } else {
        log.error("[JPA]:", "Unsupported method")
        return
    }
    // where clause construction
    let index = methodName.indexOf("By")
    let whereClauses = ""
    if (index > -1) {
        let count = 0
        let conditionsPart = methodName.substring(index + 2)
        if (conditionsPart.indexOf("And") > -1) {
            conditionsPart = conditionsPart.split("And")
            if (nums.length < conditionsPart.length) {
                log.error("[JPA]:", "Missing parameters")
                return
            }
            for (let i = 0; i < conditionsPart.length; i++) {
                const field = conditionsPart[i];
                if (typeof nums[i] == 'string') {
                    whereClauses += `${firstLower(field)} = '${nums[i]}'`
                } else {
                    whereClauses += `${firstLower(field)} = ${nums[i]}`
                }
                if (i != conditionsPart.length - 1) {
                    whereClauses += ` AND `
                }
                count = i
            }
        } else if (conditionsPart.indexOf("Or") > -1) {
            conditionsPart = conditionsPart.split("Or")
            if (nums.length < conditionsPart.length) {
                log.error("[JPA]:", "Missing parameters")
                return
            }
            for (let i = 0; i < conditionsPart.length; i++) {
                const field = conditionsPart[i];
                if (typeof nums[i] == 'string') {
                    whereClauses += `${firstLower(field)} = '${nums[i]}'`
                } else {
                    whereClauses += `${firstLower(field)} = ${nums[i]}`
                }
                if (i != conditionsPart.length - 1) {
                    whereClauses += ` OR `
                }
                count = i
            }
        } else {
            if (nums.length < 1) {
                log.error("[JPA]:", "Missing parameters")
                return
            }
            if (typeof nums[0] == 'string') {
                whereClauses = `${firstLower(conditionsPart)} = '${nums[0]}' `
            } else {
                whereClauses = `${firstLower(conditionsPart)} = ${nums[0]} `
            }
        }
        count++
        // update set clause construction
        let setClauses = ""
        let prefix = methodName.substring(0, index);
        if (prefix.length > 0) {
            prefix = prefix.split("And")
            if ((nums.length - count) < prefix.length) {
                log.error("[JPA]:", "Missing parameters")
                return
            }
            for (let i = 0; i < prefix.length; i++) {
                const field = prefix[i];
                if (typeof nums[i + count] == 'string') {
                    setClauses += `${firstLower(field)} = '${nums[i + count]}',`
                } else {
                    setClauses += `${firstLower(field)} = ${nums[i + count]},`
                }
            }
            setClauses = setClauses.slice(0, -1)
            sql += ` ${setClauses} `
        }
        sql += `WHERE ${whereClauses} `
    }
    // order sorting
    let orderByClauses = ""
    if (hasOrderBy) {
        orderByClauses = "ORDER BY "
        let conditionsPart = hasOrderBy
        for (let i = 0; i < conditionsPart.length; i++) {
            const orderItem = conditionsPart[i];
            let isDesc = orderItem.indexOf("Desc")
            let isAsc = orderItem.indexOf("Asc")
            if (isDesc > -1) {
                orderByClauses += `${firstLower(orderItem.substring(0, isDesc))} DESC,`
            }
            if (isAsc > -1) {
                orderByClauses += `${firstLower(orderItem.substring(0, isAsc))} ASC,`
            }
        }
        orderByClauses = orderByClauses.slice(0, -1)
    }
    // Check paginated conditional query
    let pageable = nums[nums.length - 1]
    if (typeof pageable == 'object' && !noPageable) {
        let clauses = ""
        for (const key in pageable) {
            const condition = pageable[key];
            if (key == "page" || key == "size") {
                continue
            }
            if (typeof condition == 'string') {
                clauses += `${firstLower(key)} = '${condition}'`
            } else {
                clauses += `${firstLower(key)} = ${condition}`
            }
            clauses += ` AND `
        }
        if (clauses.length > 0) {
            clauses = clauses.slice(0, " AND ".length * (-1))
            if (sql.indexOf("WHERE") > -1) {
                sql += `AND ${clauses} `
            } else {
                sql += `WHERE ${clauses} `
            }
        }
        sql += `${orderByClauses} `
        if (isFind && !isCount && !isEmpty(pageable.page) && !isEmpty(pageable.size)) {
            sql += `LIMIT ${pageable.size} OFFSET ${pageable.page * pageable.size} `
        }
    } else {
        sql += `${orderByClauses} `
    }
    sql += `;`;
    // log.info("[JPA]:", sql)
    let ret
    if (isFind) {
        ret = sqlite.select(sql)
        if (isCount) {
            if (ret[0] && ret[0]["COUNT(*)"]) {
                return ret[0]["COUNT(*)"]
            } else {
                return 0
            }
        }
    } else {
        ret = sqlite.exec(sql)
    }
    return ret
}

// Check for null or undefined
function isEmpty(value) {
    return value === undefined || value === null
}

// Convert first letter to lowercase
function firstLower(str) {
    return str.charAt(0).toLowerCase() + str.slice(1);
}
// JPA test
sqliteService.testJPA = function () {
    // Query
    // SELECT * FROM d1_pass_record ;
    sqliteService.d1_pass_record.find()
    // SELECT * FROM d1_pass_record WHERE a = 1 AND b = 2 ;
    sqliteService.d1_pass_record.find({ a: 1, b: 2 })
    // SELECT * FROM d1_pass_record WHERE a = 1 AND b = 2 ;
    sqliteService.d1_pass_record.find({ a: 1, b: 2, page: 1 })
    // SELECT * FROM d1_pass_record WHERE a = 1 AND b = 2 LIMIT 1 OFFSET 1 ;
    sqliteService.d1_pass_record.find({ a: 1, b: 2, page: 1, size: 1 })
    // SELECT * FROM d1_pass_record WHERE a = 1 AND b = 2 AND c = 3 ;
    sqliteService.d1_pass_record.findByAAndBAndC(1, 2, 3)
    // SELECT * FROM d1_pass_record WHERE a = 1 AND b = 2 AND c = 3 AND a = 1 AND b = 2 ;
    sqliteService.d1_pass_record.findAllByAAndBAndC(1, 2, 3, { a: 1, b: 2 })
    // SELECT * FROM d1_pass_record WHERE a = 1 AND b = 2 AND c = 3 AND a = 1 AND b = 2 LIMIT 1 OFFSET 1 ;
    sqliteService.d1_pass_record.findAllByAAndBAndC(1, 2, 3, { a: 1, b: 2, page: 1, size: 1 })
    // SELECT * FROM d1_pass_record WHERE a = 1 AND b = 2 AND c = 3 AND a = 1 AND b = 2 ORDER BY a DESC,b ASC,c ASC LIMIT 1 OFFSET 1 ;
    sqliteService.d1_pass_record.findAllByAAndBAndCOrderByADescBAscCAsc(1, 2, 3, { a: 1, b: 2, page: 1, size: 1 })
    // Delete
    // DELETE FROM d1_pass_record ;
    sqliteService.d1_pass_record.delete()
    // DELETE FROM d1_pass_record WHERE a = 1 AND b = 2 ;
    sqliteService.d1_pass_record.delete({ a: 1, b: 2 })
    // DELETE FROM d1_pass_record WHERE a = 1 AND b = 2 ;
    sqliteService.d1_pass_record.delete({ a: 1, b: 2, page: 1 })
    // DELETE FROM d1_pass_record WHERE a = 1 AND b = 2 ;
    sqliteService.d1_pass_record.delete({ a: 1, b: 2, page: 1, size: 1 })
    // DELETE FROM d1_pass_record WHERE a = 1 AND b = 2 AND c = 3 ;
    sqliteService.d1_pass_record.deleteByAAndBAndC(1, 2, 3)
    // DELETE FROM d1_pass_record WHERE a = 1 AND b = 2 AND c = 3 AND a = 1 AND b = 2 ;
    sqliteService.d1_pass_record.deleteByAAndBAndC(1, 2, 3, { a: 1, b: 2 })
    // DELETE FROM d1_pass_record WHERE a = 1 AND b = 2 AND c = 3 AND a = 1 AND b = 2 ;
    sqliteService.d1_pass_record.deleteByAAndBAndC(1, 2, 3, { a: 1, b: 2, page: 1, size: 1 })
    // DELETE FROM d1_pass_record ;
    sqliteService.d1_pass_record.deleteAll()
    // DELETE FROM d1_pass_record WHERE a = 1 AND b = 2 ;
    sqliteService.d1_pass_record.deleteAll({ a: 1, b: 2 })
    // DELETE FROM d1_pass_record WHERE a = 1 AND b = 2 ;
    sqliteService.d1_pass_record.deleteAll({ a: 1, b: 2, page: 1 })
    // DELETE FROM d1_pass_record WHERE a = 1 AND b = 2 ;
    sqliteService.d1_pass_record.deleteAll({ a: 1, b: 2, page: 1, size: 1 })
    // DELETE FROM d1_pass_record ;
    sqliteService.d1_pass_record.deleteAllByAAndBAndC(1, 2, 3)
    // DELETE FROM d1_pass_record WHERE a = 1 AND b = 2 ;
    sqliteService.d1_pass_record.deleteAllByAAndBAndC(1, 2, 3, { a: 1, b: 2 })
    // DELETE FROM d1_pass_record WHERE a = 1 AND b = 2 ;
    sqliteService.d1_pass_record.deleteAllByAAndBAndC(1, 2, 3, { a: 1, b: 2, page: 1, size: 1 })
    // DELETE FROM d1_pass_record WHERE (a = 1 AND b = 2) OR (a = 1 AND b = 2 AND page = 1) OR (a = 1 AND b = 2 AND page = 1 AND size = 1);
    sqliteService.d1_pass_record.deleteInBatch([{ a: 1, b: 2 }, { a: 1, b: 2, page: 1 }, { a: 1, b: 2, page: 1, size: 1 }])
    // DELETE FROM d1_pass_record WHERE id IN (1 ,2 ,3 );
    sqliteService.d1_pass_record.deleteByIdInBatch([1, 2, 3])
    // Update
    // UPDATE d1_pass_record SET a = 4 WHERE b = 1 AND c = 2 AND d = 3 ;
    sqliteService.d1_pass_record.updateAByBAndCAndD(1, 2, 3, 4)
    // UPDATE d1_pass_record SET a = 4,b = 5,c = 6 WHERE d = 1 AND e = 2 AND f = 3 ;
    sqliteService.d1_pass_record.updateAAndBAndCByDAndEAndF(1, 2, 3, 4, 5, 6)
    // Add (Insert)
    // INSERT INTO d1_pass_record VALUES (,,,,,,,0,0,,);
    sqliteService.d1_pass_record.save({ a: 1, b: 2 })
    // INSERT INTO d1_pass_record VALUES (,,,,,,,0,0,,), (,,,,,,,0,0,,);
    sqliteService.d1_pass_record.saveAll([{ a: 1, b: 2 }, { a: 1, b: 2 }])
    // Aggregate
    // SELECT COUNT(*) FROM d1_pass_record ;
    sqliteService.d1_pass_record.count();
    // SELECT COUNT(*) FROM d1_pass_record WHERE a = 1 AND b = 2 AND c = 3 ;
    sqliteService.d1_pass_record.countByAAndBAndC(1, 2, 3);
}

sqliteService.securityFindAllByCodeAndTypeAndTimeAndkey = function (code, type, id, time, key, index) {
    var query = `SELECT * FROM d1_security WHERE 1=1`
    if (code) {
        query += ` AND code = '${code}'`
    }
    if (type) {
        query += ` AND type = '${type}'`
    }
    if (id) {
        query += ` AND securityId = '${id}'`
    }
    if (index) {
        query += ` AND door = '${index}'`
    }
    if (key) {
        query += ` AND key = '${key}'`
    }
    if (time) {
        query += ` AND endTime >= '${time}'`
    }
    return sqlite.select(query)
}

export default sqliteService