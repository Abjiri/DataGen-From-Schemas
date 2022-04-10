function extendSchema(json, schema, type, key) {
    if (key == "not") {
        switch (type) {
            case "number": notNumeric(schema); break
        }
    }
    
    if ("const" in schema) extendPredefinedValue(json, schema, "const")
    else if ("enum" in schema) extendPredefinedValue(json, schema, "enum")
    else {
        if ("default" in schema) extendPredefinedValue(json, schema, "default")

        switch (type) {
            case "number": extendNumeric(json, schema); break
            case "string": extendString(json, schema); break
        }
    }
}

function extendPredefinedValue(json, schema, key) {
    if (key in json) json[key] = json[key].concat(schema[key])
    else json[key] = schema[key]
}

function extendString(json, schema) {
    if ("pattern" in schema) json.pattern = schema.pattern
    else if ("format" in schema) json.format = schema.format
    else {
        let {minLength, maxLength} = schema

        if (minLength != undefined) {
            if ("minLength" in json) {
                if (minLength > json.minLength) json.minLength = minLength
            } 
            else json.minLength = minLength
        }

        if (maxLength != undefined) {
            if ("maxLength" in json) {
                if (maxLength < json.maxLength) json.maxLength = maxLength
            } 
            else json.maxLength = maxLength
        }
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

function notNumeric(json) {
    let invertSchema = (old_k, new_k) => {
        let value = json[old_k]
        Object.keys(json).map(k => delete json[k])
        json[new_k] = value
    }

    if ("integer" in json) json.integer = false

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

module.exports = { extendSchema }