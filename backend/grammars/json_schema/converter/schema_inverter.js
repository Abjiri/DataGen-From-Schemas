function notGenericKeys(json) {
    if ("const" in json) {
        json.notValues = json.const
        delete json.const
    }
    if ("enum" in json) {
        if ("notValues" in json) json.notValues = json.notValues.concat(json.enum)
        else json.notValues = json.enum
        delete json.enum
    }
    if ("default" in json) {
        json.notDefault = json.default
        delete json.default
    }
}

function notNumeric(json) {
    let invertSchema = (old_k, new_k) => {
        let value = json[old_k]
        Object.keys(json).map(k => delete json[k])
        json[new_k] = value
    }

    if ("integer" in json) {
        if (json.integer) json.integer = false
        else delete json.integer
    }
    if ("mininum" in json) invertSchema("minimum", "exclusiveMaximum")
    else if ("exclusiveMinimum" in json) invertSchema("exclusiveMinimum", "maximum")
    else if ("maximum" in json) invertSchema("maximum", "exclusiveMinimum")
    else if ("exclusiveMaximum" in json) invertSchema("exclusiveMaximum", "minimum")
    else {
        let {multipleOf, notMultipleOf} = json

        if (multipleOf !== undefined && notMultipleOf !== undefined) {
            let temp = multipleOf
            json.multipleOf = notMultipleOf
            json.notMultipleOf = temp
        }
        else if (multipleOf !== undefined) {
            json.notMultipleOf = multipleOf
            delete json.multipleOf
        }
        else if (notMultipleOf !== undefined) {
            json.multipleOf = notMultipleOf
            delete json.notMultipleOf
        }
    }
    return json
}

function notString(json) {
    if ("pattern" in json) json.pattern = `^((?!(${json.pattern})).){${"minLength" in json ? json.minLength : 10},${"maxLength" in json ? json.maxLength : 30}}`
    if ("format" in json) json.notFormat = [json.format]
    if ("maxLength" in json) {
        json.minLength = json.maxLength+1
        delete json.maxLength
    }
    else if ("minLength" in json) {
        json.maxLength = json.minLength - (!json.minLength ? 0 : 1)
        delete json.minLength
    }
}

module.exports = {
    notGenericKeys,
    notNumeric,
    notString
}