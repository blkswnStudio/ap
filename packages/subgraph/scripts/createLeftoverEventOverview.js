const fs = require('fs');
const path = require('path');

const srcDirectory = 'src';
const entitiesDirectory = 'src/entities';
const outputFile = 'scripts/leftover-event-mapping.txt';

// Function to recursively read all files in a directory
function readFilesRecursively(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      fileList = readFilesRecursively(filePath, fileList);
    } else if (filePath.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

// Function to extract entity handler functions from a file
function extractEntityHandlerFunctions(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const regex = /export function (\w+)/g;
  let match;
  const functions = [];
  while ((match = regex.exec(content)) !== null) {
    functions.push(match[1]);
  }
  return functions;
}

// Function to extract the content of each event handler function from a file
function getFunctionContent(content, functionName) {
  const functionStartRegex = new RegExp(`export function ${functionName}\\(`);
  const functionStartIndex = content.search(functionStartRegex);
  if (functionStartIndex === -1) return '';

  let bracketsCount = 0;
  let inFunction = false;
  let functionContent = '';

  for (let i = functionStartIndex; i < content.length; i++) {
    if (content[i] === '{') {
      bracketsCount++;
      inFunction = true;
    } else if (content[i] === '}') {
      bracketsCount--;
    }

    if (inFunction) {
      functionContent += content[i];
    }

    if (bracketsCount === 0 && inFunction) break;
  }

  return functionContent;
}

// Function to analyze event handlers and list those not using any entity handlers
function analyzeEventHandlers() {
  const entityFiles = readFilesRecursively(entitiesDirectory);
  const entityHandlers = entityFiles.reduce((acc, file) => {
    acc = acc.concat(extractEntityHandlerFunctions(file));
    return acc;
  }, []);

  const eventHandlerFiles = readFilesRecursively(srcDirectory).filter((file) => !file.startsWith(entitiesDirectory));

  let result = '';

  eventHandlerFiles.forEach((file) => {
    const content = fs.readFileSync(file, 'utf-8');
    const contractName = path.basename(file, '.ts');
    const eventHandlerFunctions = extractEntityHandlerFunctions(file);

    let unusedEventHandlers = eventHandlerFunctions.filter((fn) => {
      const functionContent = getFunctionContent(content, fn);
      return !entityHandlers.some((entityFn) => functionContent.includes(entityFn));
    });

    if (unusedEventHandlers.length > 0) {
      result += `contract (${contractName})\n`;
      unusedEventHandlers.forEach((fn) => {
        result += `  > ${fn}\n`;
      });
    }
  });

  fs.writeFileSync(outputFile, result);
}

analyzeEventHandlers();
console.log(`Analysis complete. Check the output in ${outputFile}`);
