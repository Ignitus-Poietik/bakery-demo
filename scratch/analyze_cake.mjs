import fs from 'node:fs'
import path from 'node:path'

// Let's analyze cake-whole.png pixel alpha distribution
// We can use a pure node script or powershell script to find the tier boundaries
const wholeFile = 'frontend/public/hero/cake-whole.png'
console.log('Exists:', fs.existsSync(wholeFile), 'Size:', fs.statSync(wholeFile).size)
