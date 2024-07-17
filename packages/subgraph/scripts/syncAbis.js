const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '../abis');
const destinationDir = path.join(__dirname, '../../contracts/abi');

// Read all files in the source directory
fs.readdir(sourceDir, (err, files) => {
  if (err) {
    console.error('Error reading the source directory:', err);
    return;
  }

  files.forEach((file) => {
    const sourceFilePath = path.join(sourceDir, file);
    const destinationFilePath = path.join(destinationDir, file);

    // Check if the file exists in the destination directory
    if (fs.existsSync(destinationFilePath)) {
      // Copy file from destination to source
      fs.copyFile(destinationFilePath, sourceFilePath, (err) => {
        if (err) {
          console.error(`Error copying ${file}:`, err);
        } else {
          console.log(`${file} was successfully replaced.`);
        }
      });
    } else {
      console.log(`${file} does not exist in the destination directory.`);
    }
  });
});
