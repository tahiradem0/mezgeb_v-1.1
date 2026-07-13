const fs = require('fs');

const file = process.argv[2];
if (!file) process.exit(1);

let content = fs.readFileSync(file, 'utf8');

// Replace StyleSheet.create
content = content.replace(/const styles = StyleSheet\.create\(\{/g, 'const createStyles = (theme) => StyleSheet.create({');

// Add useMemo to component
content = content.replace(/const theme = useTheme\(\);/, 'const theme = useTheme();\n  const styles = React.useMemo(() => createStyles(theme), [theme]);');

// Hex replacements mapping
const replacements = [
  { regex: /['"]#(FAFAFA|f5f5f5|f4f4f4|f9f9f9)['"]/gi, replace: 'theme.colors.background' },
  { regex: /['"]#(ffffff|fff)['"]/gi, replace: 'theme.colors.surface' },
  { regex: /['"]#(2e2e2e|333333|333|212121|000000|000)['"]/gi, replace: 'theme.colors.textPrimary' },
  { regex: /['"]#(666666|666|888888|888|444444|444)['"]/gi, replace: 'theme.colors.textSecondary' },
  { regex: /['"]#(a0a0a0|aaaaaa|aaa|cccccc|ccc)['"]/gi, replace: 'theme.colors.textMuted' },
  { regex: /['"]#(f0f0f0|e0e0e0|eeeeee|f8f8f8)['"]/gi, replace: 'theme.colors.border' },
];

let stylesSectionIdx = content.indexOf('const createStyles = (theme) => StyleSheet.create({');
if (stylesSectionIdx !== -1) {
  let stylesStr = content.substring(stylesSectionIdx);
  for (let r of replacements) {
    stylesStr = stylesStr.replace(r.regex, r.replace);
  }
  content = content.substring(0, stylesSectionIdx) + stylesStr;
}

fs.writeFileSync(file, content);
console.log(`Refactored styles in ${file}`);
