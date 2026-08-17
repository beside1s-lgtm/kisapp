const fs = require('fs');

let content = fs.readFileSync('C:/myapp/kisbus/src/app/admin/components/teacher-management-tab.tsx', 'utf8');

// Apply Import Rules
content = content.replace(/'@\/lib\/firebase-data'/g, "'@/lib/kisbus'");
content = content.replace(/'@\/lib\/types'/g, "'@/lib/kisbus/types'");
content = content.replace(/'@\/lib\/utils'/g, "'@/lib/kisbus/utils'");
content = content.replace(/import \{ db \} from '@\/lib\/firebase';/g, "import { getKisbusDb as db } from '@/lib/kisbus/firebase';");
content = content.replace(/import \{ setDocument \} from '@\/lib\/firebase\/core';\r?\n/g, "");
content = content.replace(/addSaturdayTeacher\r?\n\} from '@\/lib\/kisbus';/g, "addSaturdayTeacher,\n    setDocument\n} from '@/lib/kisbus';");

// Replace db references with db()
content = content.replace(/doc\(db,/g, "doc(db(),");
content = content.replace(/writeBatch\(db\)/g, "writeBatch(db())");

// kisapp specific state reset
content = content.replace(/<Dialog open=\{isTeacherDialogOpen\} onOpenChange=\{setIsTeacherDialogOpen\}>/g, "<Dialog open={isTeacherDialogOpen} onOpenChange={(open) => { setIsTeacherDialogOpen(open); if(!open) setSelectedBusForTeacher(null); }}>");

fs.writeFileSync('C:/myapp/kisapp/src/app/(app)/admin/bus/components/teacher-management-tab.tsx', content, 'utf8');
console.log('Transformation complete!');
