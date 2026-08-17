const fs = require('fs');
const path = require('path');

// 1. kisbus 라이브러리 (src/lib/kisbus/)
function fixKisbusLib(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      fixKisbusLib(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const origin = content;
      
      // core.ts를 제외한 다른 파일의 '../firebase' 임포트를 './firebase'로 수정
      if (file !== 'firebase.ts') {
        content = content.replace(/import\s+{[^}]+}\s+from\s+['"]\.\.\/firebase['"]/g, "import { kisbusDb as db } from './firebase'");
      }
      
      if (content !== origin) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Fixed Lib:', fullPath);
      }
    }
  });
}

// 2. 전체 페이지/컴포넌트 치환
function fixAllImports(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      fixAllImports(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const origin = content;
      
      // 본체 db 임포트 구문을 스쿨버스 전용 db 임포트로 치환
      content = content.replace(/import\s+{\s*db\s*}\s+from\s+['"]@\/lib\/firebase['"]/g, "import { kisbusDb as db } from '@/lib/kisbus/firebase'");
      content = content.replace(/import\s*\\(\s*['\"]@\/lib\/firebase['\"]\s*\\)/g, "import('@/lib/kisbus/firebase')");
      
      if (content !== origin) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Fixed Page/Comp:', fullPath);
      }
    }
  });
}

console.log('Starting DB connection routing script...');
fixKisbusLib('c:\\myapp\\kisapp\\src\\lib\\kisbus');

fixAllImports('c:\\myapp\\kisapp\\src\\app\\teacher\\bus');
fixAllImports('c:\\myapp\\kisapp\\src\\app\\parents\\bus');
fixAllImports('c:\\myapp\\kisapp\\src\\app\\(app)\\parents\\bus');
fixAllImports('c:\\myapp\\kisapp\\src\\app\\(app)\\admin\\bus');
fixAllImports('c:\\myapp\\kisapp\\src\\components\\bus');
console.log('DB connection routing completed.');
