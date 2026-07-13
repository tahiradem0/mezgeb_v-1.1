const fs = require('fs');

const files = [
  'src/screens/Main/ExpensesScreen.js',
  'src/screens/Main/GroupsScreen.js',
  'src/screens/Main/ReportScreen.js',
  'src/screens/Auth/LoginScreen.js',
  'src/screens/Auth/RegisterScreen.js',
  'src/components/EditExpenseModal.js',
  'src/components/ManageCategoryModal.js'
];

const replacements = [
  { regex: /['"]#(FAFAFA|f5f5f5|f4f4f4|f9f9f9)['"]/gi, replace: 'theme.colors.background' },
  { regex: /['"]#(ffffff|fff)['"]/gi, replace: 'theme.colors.surface' },
  { regex: /['"]#(2e2e2e|333333|333|212121|000000|000)['"]/gi, replace: 'theme.colors.textPrimary' },
  { regex: /['"]#(666666|666|888888|888|444444|444)['"]/gi, replace: 'theme.colors.textSecondary' },
  { regex: /['"]#(a0a0a0|aaaaaa|aaa|cccccc|ccc|8c8c8c)['"]/gi, replace: 'theme.colors.textMuted' },
  { regex: /['"]#(f0f0f0|e0e0e0|eeeeee|f8f8f8|e8e8e8)['"]/gi, replace: 'theme.colors.border' },
];

for (let file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  // Add useTheme import if missing
  if (!content.includes('useTheme')) {
    content = content.replace(/from 'react-native-paper';/, ', useTheme } from \'react-native-paper\';');
  }

  // Ensure React is imported
  if (!content.includes('import React')) {
    content = 'import React from \'react\';\n' + content;
  }

  // Replace StyleSheet.create
  content = content.replace(/const styles = StyleSheet\.create\(\{/g, 'const createStyles = (theme) => StyleSheet.create({');

  // Insert useMemo if we successfully changed styles to createStyles
  if (content.includes('const createStyles = (theme)')) {
    // Find component definition
    const compRegex = /export default function ([A-Za-z0-9_]+)\([^)]*\) \{/;
    const match = content.match(compRegex);
    if (match) {
      const idx = match.index + match[0].length;
      if (!content.includes('const styles = React.useMemo')) {
        content = content.substring(0, idx) + '\n  const theme = useTheme();\n  const styles = React.useMemo(() => createStyles(theme), [theme]);' + content.substring(idx);
      }
    }
  }

  // Replace colors
  let stylesSectionIdx = content.indexOf('const createStyles = (theme) => StyleSheet.create({');
  if (stylesSectionIdx !== -1) {
    let stylesStr = content.substring(stylesSectionIdx);
    for (let r of replacements) {
      stylesStr = stylesStr.replace(r.regex, r.replace);
    }
    content = content.substring(0, stylesSectionIdx) + stylesStr;
  }

  fs.writeFileSync(file, content);
  console.log('Refactored', file);
}
