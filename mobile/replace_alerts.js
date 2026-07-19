const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.js')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk(srcDir);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  if (content.includes('Alert.alert')) {
    // 1. Calculate relative path to utils/CustomAlert.js
    const relativePathToSrc = path.relative(path.dirname(file), srcDir).replace(/\\/g, '/');
    const customAlertImportPath = relativePathToSrc === '' ? './utils/CustomAlert' : `${relativePathToSrc}/utils/CustomAlert`;

    // 2. Add import CustomAlert from '...'
    // Avoid double imports
    if (!content.includes('import CustomAlert')) {
      const importStatement = `import CustomAlert from '${customAlertImportPath}';\n`;
      // Find the last import statement
      const importRegex = /^import\s+.*from\s+['"].*['"];?$/gm;
      let lastMatch;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        lastMatch = match;
      }
      
      if (lastMatch) {
        const insertPos = lastMatch.index + lastMatch[0].length;
        content = content.slice(0, insertPos) + '\n' + importStatement + content.slice(insertPos);
      } else {
        content = importStatement + content;
      }
    }

    // 3. Replace all Alert.alert( with CustomAlert.alert(
    content = content.replace(/Alert\.alert\(/g, 'CustomAlert.alert(');
    
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
