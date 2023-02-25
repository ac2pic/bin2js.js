const fs = require('fs');

function listDir(folder) {
    return fs.readdirSync(folder);
}

if (process.argv.length < 4) {
    console.log('Must supply input directory and output directory.');
    process.exit(0);
}

const inDirectory = process.argv[2];
const outDirectory = process.argv[3];

const binaries = listDir(inDirectory).filter(e => e.endsWith('.bin'));
/**
 * 
 * @param {string} name 
 * @param {Buffer} binary 
 */
function createFunction(name, binary) {
    const binFuncName = name.split('-').map(piece => piece[0].toUpperCase() + piece.substring(1)).join('');
    const func = [];
    // Create a global payload list
    const boiler = 'window.pFuncs=window.pFuncs||[];';
    // add the currently generated function to the list of payloads to run
    // this means this script should be loaded dynamically
    const end = `window.pFuncs.push(${binFuncName});`;
    func.push(`function ${binFuncName}(payload_buffer_address){`);
    // We might not need to use more memory.
    let binaryByteLength = 0x1000;
    if (binary.byteLength >= 0x1000) {
        // Add missing bytes
        binaryByteLength += binary.byteLength - 0x1000;
        // Round to the next multiple of 4
        binaryByteLength = binaryByteLength - (binaryByteLength%4) + 4;
    }
    
    const allocationSize = binaryByteLength - (binaryByteLength%4096) + 4096;
    func.push(`let addr = chain.syscall(477, new int64(0x26200000, 0x9), 0x${allocationSize.toString(16).toLocaleUpperCase()}, 7, 0x41000, -1, 0);`);
    func.push(`let b=p.array_from_address(addr,0x${(binaryByteLength >> 0x2).toString(16).toLocaleUpperCase()});`);
    const alignedByteCount = Math.floor(binary.byteLength/4) * 4;
    // convert to big endian like original exploit does
    let i = 0;
    for(;i < alignedByteCount/4; i++) {
        func.push(`b[${i}]=0x${binary.readUInt32LE(i * 4).toString(16).toLocaleUpperCase()};`)
    }
    
    // This might never happen 
    if (alignedByteCount !== binary.byteLength) {
        console.log(name, "byte length is not a multiple of 4...", alignedByteCount, binary.byteLength);
    }
    func.push('return addr;');
    // Handle remaining.
    func.push('}');
    return boiler + func.join('') + end;
}

for (let i = 0; i < binaries.length; i++) {
    const binaryFileName = binaries[i];
    const binaryPath = inDirectory + `/${binaryFileName}`;
    const binaryBytes = fs.readFileSync(binaryPath);
    const binaryName = binaryFileName.replace('.bin', '');
    const outPath =  outDirectory + `/${binaryName}.js`;

    fs.writeFileSync(outPath, createFunction(binaryName, binaryBytes));
}