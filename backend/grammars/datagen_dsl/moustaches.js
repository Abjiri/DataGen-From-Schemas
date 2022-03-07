const loremIpsum = require("lorem-ipsum").loremIpsum
const moment = require('moment')
const _ = require('lodash')
const getRandomValues = require('get-random-values')
const RandExp = require('randexp')

function hex(x) { return Math.floor(x).toString(16) }

function randomize(min, max) { return Math.floor(Math.random() * ((max+1) - min) + min) }

function getDecimalsCount(min, max) {
    var decimals = 3; //3 caracteres decimais por predefinição
    const maxStr = String(max);
    const minStr = String(min);

    if (minStr.includes('.')) decimals = minStr.split('.')[1].length;
    if (maxStr.includes('.')) {
        var maxDecimals = maxStr.split('.')[1].length;
        if (decimals < maxDecimals) decimals = maxDecimals;
    }

    return decimals
}

function formatNumber(num) {
    var x = num.split('.');
    var x1 = x[0];
    var x2 = x.length > 1 ? '.' + x[1] : '';
    var rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) {
        x1 = x1.replace( rgx, '$1' + ',' + '$2' );
    }
    return x1 + x2;
}

function objectId(i) {
    return hex(Date.now() / 1000) + ' '.repeat(16).replace(/./g, () => hex(Math.random() * 16))
}

function guid(i) {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16))
}

function boolean(i) { return Math.random() < 0.5 }

function getIndexes(num, struct_types, array_indexes) {
  if (struct_types[struct_types.length-1] == "repeat") return [...Array(num).keys()]
  else if (struct_types[struct_types.length-1] == "array") return Array(num).fill(array_indexes[array_indexes.length-1])
  else {
    var index = struct_types.length-1
    while (index >= 0 && struct_types[index] == "object") index--
    if (index >= 0) {
      if (struct_types[index] == "repeat") return [...Array(num).keys()]
      else return Array(num).fill(array_indexes[array_indexes.length-1])
    }
    else return false //não está dentro de um array
  }
}

function index(offset, queue_last, struct_types, array_indexes, i) {
    var arrays = []
    if (offset == null) offset = 0
    offset = Array.isArray(offset) ? offset[i] : offset

    if (Array.isArray(queue_last.value)) queue_last.value.forEach(n => arrays.push(getIndexes(n, struct_types, array_indexes)))
    else arrays = Array(queue_last.total/queue_last.value).fill(getIndexes(queue_last.value, struct_types, array_indexes))

    if (arrays[0] === false) return false
    return arrays.flat().map(k => k + offset)[i]
}

function padding(rand, pad) {
    var negative = false, decimal = false

    if (rand[0] == '-') {negative = true; rand = rand.substr(1)}
    if (rand.includes('.')) {
        let split = rand.split('.')
        decimal = split[1]
        rand = split[0]
    }

    while (rand.length < pad) rand = "0" + rand

    if (negative) rand = '-' + rand
    if (decimal != false) rand += '.' + decimal

    return rand
}

function decimalPadding(rand, pad) {
    var len = rand.substring(rand.indexOf('.')).length
    for (let i = len; i < pad; i++) rand += '0'

    return rand
}

function letter(lettercase, i) {
    var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

    if (lettercase == "uppercase") letters = letters.slice(0,26)
    else if (lettercase == "lowercase") letters = letters.slice(26,letters.length)

    return letters[Math.floor(Math.random() * letters.length)]
}

function integer(min, max, i) {
    min = Array.isArray(min) ? min[i] : min
    max = Array.isArray(max) ? max[i] : max
    return randomize(min,max)
}

function integerOfSize(size, i) {
    size = Array.isArray(size) ? size[i] : size
    let neg = false
    
    if (!size) return 0
    else if (size < 0) { size = 0-size; neg = true }

    let min = "0".repeat(size), max = "9".repeat(size)
    if (size > 1) min[0] = "1"
    min = Number.parseInt(min), max = Number.parseInt(max)

    let rand = randomize(min, max)
    if (neg) rand = 0 - rand
    return rand
}

function formattedInteger(min, max, pad, unit, i) {
    min = Array.isArray(min) ? min[i] : min
    max = Array.isArray(max) ? max[i] : max
    pad = Array.isArray(pad) ? pad[i] : pad

    var rand = randomize(min, max).toString()
    return padding(rand,pad) + unit
}

function float(min, max, decimals, i) {
    min = Array.isArray(min) ? min[i] : min
    max = Array.isArray(max) ? max[i] : max

    decimals = Array.isArray(decimals) ? decimals[i] : decimals
    if (decimals == null) decimals = getDecimalsCount(min,max)

    var random = min + (max - min) * Math.random()
    return Math.round((random + Number.EPSILON) * Math.pow(10,decimals)) / Math.pow(10,decimals)
}

function formattedFloat(min, max, decimals, pad, format, i) {
    min = Array.isArray(min) ? min[i] : min
    max = Array.isArray(max) ? max[i] : max
    pad = Array.isArray(pad) ? pad[i] : pad

    decimals = Array.isArray(decimals) ? decimals[i] : decimals
    if (decimals == null) decimals = getDecimalsCount(min,max)

    var random = min + (max - min) * Math.random()
    var rounded = Math.round((random + Number.EPSILON) * Math.pow(10,decimals)) / Math.pow(10,decimals)

    rounded = decimalPadding(rounded.toString(), decimals)
    rounded = padding(rounded, pad)
  
    var split = formatNumber(rounded).split('.')
    rounded = split[0].replace(/,/g, format[1])
  
    if (split[1] != null) rounded += format[3] + split[1] 
    if (format.length > 6) rounded += format.substring(6)

    return rounded
}

function position(lat, long, i) {
    lat = (lat != null && Array.isArray(lat[0])) ? lat[i] : lat
    long = (long != null && Array.isArray(long[0])) ? long[i] : long

    if (!lat) return "(" + float(-90,90,5,null) + ", " + float(-180,180,5,null) + ")"
    else {
        if (lat[0] > lat[1]) {var latmax = lat[0]; lat[0] = lat[1]; lat[1] = latmax}
        if (long[0] > long[1]) {var longmax = long[0]; long[0] = long[1]; long[1] = longmax}

        return "(" + float(lat[0], lat[1], 5, null) + ", " + float(long[0], long[1], 5, null) + ")"
    }
}

function pt_phone_number(extension, i) {
    var number = "9" + random([1,2,3,6])
    while (number.length < 11) {
        if (number.length == 3 || number.length == 7) number += " "
        else number += (Math.floor(Math.random() * 9) + 1)
    }
    return extension ? ("+351 " + number) : number
}

function newDate(str) {
    var split = str.replace(/[^\d]/g, "/").split("/")
    return new Date(parseInt(split[2]), parseInt(split[1])-1, parseInt(split[0]))
}

function date(start, end, format, i) {
    start = Array.isArray(start) ? start[i] : start
    end = (end !== null && Array.isArray(end)) ? end[i] : end
    
    start = newDate(start)
    end = !end ? new Date() : newDate(end)

    var random = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
    if (format != null) random = moment(random).format(format.replace(/A/g, "Y"))

    return random
}

function time(format, range, unitsBool, limits, i) {
    let start, end
    
    if (limits == null) { start = "00:00:00"; end = "23:59:59" }
    else { start = limits.start; end = limits.end }

    start = Array.isArray(start) ? start[i] : start
    end = Array.isArray(end) ? end[i] : end

    start = start.split(":").map(x => parseInt(x)).reverse().reduce((acc,cur,j) => acc + (j==0 ? cur : cur*Math.pow(60,j)), 0),
    end = end.split(":").map(x => parseInt(x)).reverse().reduce((acc,cur,j) => acc + (j==0 ? cur : cur*Math.pow(60,j)), 0)

    let rand = randomize(start, end),
        randArr = [ padding((rand/3600|0).toString(),2), padding((rand/60%60|0).toString(),2), padding((rand%60).toString(),2) ],
        units = unitsBool ? ["h","min","s"] : [":",":"],
        iter = [], AMPM = "", final = ""

    if (range == 12) {
        if (randArr[0] == 0) { randArr[0] = 12; AMPM = " AM" }
        else if (randArr[0] == 12) AMPM = " PM"
        else if (randArr[0] > 12) { randArr[0] = padding((randArr[0]-12).toString(),2); AMPM = " PM" }
        else AMPM = " AM"
    }
    else AMPM = ""

    switch(format) {
        case "hh:mm:ss": iter = [0,1,2]; break;
        case "hh:mm": iter = [0,1]; break;
        case "hh:ss": iter = [0,2]; break;
        case "mm:ss": iter = [1,2]; break;
        case "hh": iter = [0]; break;
        case "mm": iter = [1]; break;
        case "ss": iter = [2]; break;
    }

    for (let j = 0; j < iter.length; j++) {
        final += ((j>0 && unitsBool) ? " " : "")
        final += randArr[iter[j]] 
        final += ((!unitsBool && j == iter.length-1) ? "" : units[iter[j]])
    }
    final += AMPM

    return final
}

function lorem(units, min, max, i) {
    min = Array.isArray(min) ? min[i] : min
    max = (max != null && Array.isArray(max)) ? max[i] : max

    if (max != null) min = randomize(min, max)
    return loremIpsum({ count: min, units })
}

function random(values, i, sample) {
    values = values.map(x => Array.isArray(x) ? x[i] : x)
    if (sample > -1) return _.sampleSize(values, sample)
    return values[Math.floor(Math.random() * values.length)]
}

function range(init, end, step, i) {
    init = Array.isArray(init) ? init[i] : init

    if (end == null) {
      end = init; init = 0
      step = init < end ? 1 : -1
    }
    else {
        end = Array.isArray(end) ? end[i] : end
        if (step == null || step == 0) step = init < end ? 1 : -1
        else step = Array.isArray(step) ? step[i] : step
    }

    if ((end > init && step < 0) || (end < init && step > 0)) return false

    var range = []
    for (let i = init; (init < end) ? i < end : i > end; i += step) range.push(i)
    return range
}

function pattern(pattern, i) {
    pattern = Array.isArray(pattern) ? pattern[i] : pattern
    return new RandExp(pattern).gen()
}

function multipleOf(num, i) {
    num = Array.isArray(num) ? num[i] : num
    return num * randomize(0,1000)
}

function stringOfSize(chars, i) {
    chars = Array.isArray(chars) ? chars[i] : chars

    let str = ""
    while (str.length < chars) str += loremIpsum({ count: 1, units: "sentences" }) + " "
    return str.slice(0, chars)
}

module.exports = {
    objectId,
    guid,
    boolean,
    index,
    integer,
    integerOfSize,
    formattedInteger,
    float,
    formattedFloat,
    letter,
    position,
    pt_phone_number,
    date,
    time,
    lorem,
    random,
    range,
    pattern,
    multipleOf,
    stringOfSize
}