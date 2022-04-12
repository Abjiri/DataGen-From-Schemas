function extendSchema(json, schema, type, key) {
    if (key == "not") {
        notGenericKeys(schema)
        switch (type) {
            case "number": notNumeric(schema); break
            case "string": notString(schema); break
        }
    }
    
    ["const","enum","default","notValues","notDefault"].filter(k => k in schema).map(k => extendPredefinedValue(json, schema, k))
    switch (type) {
        case "number": extendNumeric(json, schema); break
        case "string": extendString(json, schema); break
    }
}

function extendPredefinedValue(json, schema, key) {
    if (key in json) json[key] = json[key].concat(schema[key])
    else json[key] = schema[key]
}

function extendString(json, schema) {
    if ("pattern" in schema) json.pattern = schema.pattern
    if ("format" in schema) json.format = schema.format
    if ("notFormat" in schema) {
        if ("notFormat" in json) json.notFormat = json.notFormat.concat(schema.notFormat)
        else json.notFormat = schema.notFormat
    }

    let {minLength, maxLength} = schema

    if (minLength != undefined) {
        if ("minLength" in json) {
            if (minLength > json.minLength) json.minLength = minLength
        } 
        else json.minLength = minLength

        if ("maxLength" in json && json.maxLength < json.minLength) delete json.maxLength
    }

    if (maxLength != undefined) {
        if ("maxLength" in json) {
            if (maxLength < json.maxLength) json.maxLength = maxLength
        } 
        else json.maxLength = maxLength

        if ("minLength" in json && json.minLength > json.maxLength) delete json.minLength
    }
}

function extendNumeric(json, schema) {
    let {multipleOf, notMultipleOf, minimum, maximum, exclusiveMinimum, exclusiveMaximum} = schema
    if ("integer" in schema) json.integer = schema.integer

    if (multipleOf !== undefined) {
        if ("multipleOf" in json) json.multipleOf = json.multipleOf.concat(multipleOf.filter(x => !json.multipleOf.includes(x)))
        else json.multipleOf = multipleOf
    }
    if (notMultipleOf !== undefined) {
        if ("notMultipleOf" in json) json.notMultipleOf = json.notMultipleOf.concat(notMultipleOf.filter(x => !json.notMultipleOf.includes(x)))
        else json.notMultipleOf = notMultipleOf
    }

    if (minimum !== undefined) {
        if ("minimum" in json) {
            if (minimum > json.minimum) json.minimum = minimum
        } 
        else if ("exclusiveMinimum" in json) {
            if (minimum > json.exclusiveMinimum) {json.minimum = minimum; delete json.exclusiveMinimum}
        }
        else json.minimum = minimum

        if ("maximum" in json && json.minimum > json.maximum) delete json.maximum
        else if ("exclusiveMaximum" in json && json.minimum >= json.exclusiveMaximum) delete json.exclusiveMaximum
    }
    else if (exclusiveMinimum !== undefined) {
        if ("minimum" in json) {
            if (exclusiveMinimum >= json.minimum) {json.exclusiveMinimum = exclusiveMinimum; delete json.minimum}
        } 
        else if ("exclusiveMinimum" in json) {
            if (exclusiveMinimum > json.exclusiveMinimum) json.exclusiveMinimum = exclusiveMinimum
        }
        else json.exclusiveMinimum = exclusiveMinimum

        if ("maximum" in json && json.exclusiveMinimum >= json.maximum) delete json.maximum
        else if ("exclusiveMaximum" in json && json.exclusiveMinimum >= json.exclusiveMaximum) delete json.exclusiveMaximum
    }

    if (maximum !== undefined) {
        if ("maximum" in json) {
            if (maximum < json.maximum) json.maximum = maximum
        } 
        else if ("exclusiveMaximum" in json) {
            if (maximum < json.exclusiveMaximum) {json.maximum = maximum; delete json.exclusiveMaximum}
        }
        else json.maximum = maximum

        if ("minimum" in json && json.maximum < json.minimum) delete json.minimum
        else if ("exclusiveMinimum" in json && json.maximum <= json.exclusiveMinimum) delete json.exclusiveMinimum
    }
    else if (exclusiveMaximum !== undefined) {
        if ("maximum" in json) {
            if (exclusiveMaximum <= json.maximum) {json.exclusiveMaximum = exclusiveMaximum; delete json.maximum}
        } 
        else if ("exclusiveMaximum" in json) {
            if (exclusiveMaximum < json.exclusiveMaximum) json.exclusiveMaximum = exclusiveMaximum
        }
        else json.exclusiveMaximum = exclusiveMaximum

        if ("minimum" in json && json.exclusiveMaximum <= json.minimum) delete json.minimum
        else if ("exclusiveMinimum" in json && json.exclusiveMaximum <= json.exclusiveMinimum) delete json.exclusiveMinimum
    }
}

function notGenericKeys(json) {
    if ("const" in json) {
        json.notValues = json.const
        delete json.const
    }
    if ("enum" in json) {
        if ("notValues" in json) json.notValues = json.notValues.concat(json.enum)
        else json.notValues = json.enum
        delete json.num
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

module.exports = { extendSchema }