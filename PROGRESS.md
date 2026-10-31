# PipeDraft 3D: สถานะงาน / Progress

อัปเดตล่าสุด: 18 ต.ค. 2026 (ปิดงานวันนี้)

แอปวางท่อ 3 มิติแบบออฟไลน์สำหรับ iPad คนเดียวใช้ ลิงก์: https://ot46110-jpg.github.io/pipedraft/
(เปิดตอนมีเน็ตแล้วปิดเปิดใหม่ 1 ครั้ง เพื่ออัปเดต เวอร์ชันใหม่จะโหลดเอง)

## วิธีเริ่มต่อ (สำหรับ Claude / ตัวเอง)
- แก้เฉพาะ `src/index.src.html` ห้ามแก้ `index.html` และ `sw.js` ด้วยมือ
- `node build.js` สร้างไฟล์ `index.html` และ `sw.js`
- `node test/bom.test.js` รันเทสต์ (ต้องขึ้น `all checks passed`)
- รายละเอียดกฎและโครงสร้างอยู่ใน `CLAUDE.md`
- ยังไม่เคยลองบน iPad จริงในรอบนี้ (งาน 20 ต.ค. ทดสอบด้วยเทสต์ headless และเปิด Edge headless ดูว่าโหลดไม่มี error เท่านั้น ไม่ได้กดเมนูในเบราว์เซอร์จริง) ทดสอบด้วยเทสต์และ Chrome บนคอมเท่านั้น

## ทำเสร็จแล้ว
- วาดท่อ: พิมพ์ความยาว/พิกัด (mm), Start at, ล็อกแกน X/Y/Z, ปุ่ม ▲▼, แผงความสูง (แตะตัวเลข EL: พิมพ์ความสูง, ระดับที่ตั้งชื่อได้, หลอดดูดสี)
- แก้ไข: ยืด/ย่อปลายท่อ (ส่วนที่ต่อตามไป), ย้าย, คัดลอก, mirror, หมุน, พิมพ์ระยะวาล์ว, ลบ fitting (ลบท่อสั้นสุดที่จุดนั้น)
- Fitting: elbow LR/SR/3D, tee, reducing tee, lateral, cross จริง, olet หลายแบบ, stub-in, reducer (concentric/eccentric เลือกด้าน flat top/bottom/side), swage, bushing, cap, plug, return bend, ท่อ 3 เส้นที่มุมเป็นข้องอ + branch, จุดที่ทำไม่ได้ขึ้นลูกบอลแดง
- ตรวจท่อชนตัววาล์ว (ตัววาล์วเป็นทรงกระบอกตามท่อที่วาล์วอยู่, ท่อแยกที่เริ่มจากท่อหลักข้างวาล์วไม่นับ, ท่อชนขึ้นสีแดงพร้อมลูกบอลแดง)
- วาล์ว 13 แบบ เลือกปลาย Flanged/Threaded/Welded, วาล์วหน้าแปลนใส่หน้าแปลนประกบให้เอง, หน้าแปลนเดี่ยวที่ปลายท่อ, ทิศ handwheel, vent/drain, slope (หมายเหตุ), support 5 แบบ, เครื่องมือวัด/PSV, ปั๊มและถัง
- มาตรฐาน ASME / JIS 10K / EN PN16, ขนาด NPS / DN / JIS A, มาตรฐานและวัสดุต่อแถว BOM
- BOM, cut list, เลข weld (shop/field), spool, line list (+CSV), hydraulics, ตรวจท่อชน (pipe/pipe, pipe/equipment)
- แผ่น iso: จัด layout อัตโนมัติ, เลือกมุมมองอัตโนมัติ, แผ่นแยกต่อไลน์, title block, symbol แบบโบว์ไท (หรือรูปวาด: ปุ่ม Symbols/Pictures), เลข weld ในหกเหลี่ยม, ป้าย spool, ลูกศรไหลน้อยลง, ปุ่ม Save PDF / Print
- แผ่น P&ID, สัญลักษณ์อ้างอิง, ส่งออก DXF/CSV/SVG/PNG
- สำรองข้อมูลอัตโนมัติ 8 ชุด (File → Backups)
- (20 ต.ค. 2026) อุปกรณ์สร้างเอง (Custom parts): ⋯ → Project → Custom parts เพิ่ม/แก้/ทำซ้ำ/ลบ ชิ้นส่วนแบบ inline (ชื่อ, ยี่ห้อ, รุ่น, ความยาว mm, น้ำหนัก, ค่า K, prefix แท็ก, รูปจากรูปภาพ/Files ย่อเหลือ 160 px ไม่เกิน ~40 KB) แล้ววางจาก Parts → Custom เหมือน inline fitting; ใช้ใน BOM (ยี่ห้อ/รุ่น/น้ำหนักอยู่คอลัมน์มาตรฐาน), cut list, แท็ก, balloon บน iso (ภาพในสไตล์ Pictures), hydraulics; ลบรายการที่ถูกใช้แล้วชิ้นที่วางไว้ยังอยู่ (เตือนจำนวนที่วางอยู่); แก้ความยาวแล้วท่อทุกจุดตามทันที; File → Export/Import custom parts (.json) รวมตาม id; ทดสอบด้วยเทสต์ headless + Edge headless (เปิดแผง เพิ่มรายการ วางบนท่อ ลบ เลือกรูป)
- (20 ต.ค. 2026) อุปกรณ์สร้างเอง เฟส 2 (Custom parts → Add equipment): เครื่องจักรของเราเอง (ปั๊ม, ถัง, สกิด, เครื่องแลกเปลี่ยนความร้อน ฯลฯ) เป็นกล่องหรือถังตั้ง กำหนดขนาด mm (100-20000), สี 6 สี, nozzle สูงสุด 8 ตัว (ตำแหน่ง X/Y/Z จากกึ่งกลางฐาน, ทิศ ±X ±Y ±Z, ขนาด NPS) วางจาก Parts → Equipment เหมือนปั๊ม/ถังของเดิม หมุนทีละ 90° ท่อ snap เข้า nozzle ได้ รองรับ BOM (ชื่อ ยี่ห้อ รุ่น), แท็กตาม prefix, แผ่น iso (กล่อง/ทรงกระบอกพร้อมขา nozzle), แผ่น P&ID (สี่เหลี่ยม/ถัง), ตรวจท่อชนตัวถัง (เว้น nozzle 0.3 ม.), เครื่องมือวัดติดบนอุปกรณ์, ท่อที่ผูกกับอุปกรณ์ย้ายเป็นกลุ่มไม่ได้ แก้รายการแล้วทุกชิ้นที่วางไว้ตามอัตโนมัติ ลบรายการแล้วชิ้นที่วางไว้ยังอยู่ (เก็บสำเนาจำกัดขนาดในตัวอุปกรณ์) ถ้าแก้ nozzle จนท่อหลุด nozzle ท่อยังอยู่และมี toast บอกจำนวน ไฟล์เก่า/ไฟล์ที่แก้มือถูกกรอง (equipment ที่ k แปลกถูกทิ้ง ค่าเกินช่วงถูกบีบ) เทสต์: headless 44 ข้อใหม่ และ Edge headless (กรอกแผงจริง, วางจริง, ท่อ snap, iso, P&ID, ถ่ายภาพ 3D ดูแล้ว)
- (20 ต.ค. 2026) line designation `2"-CW-L-001-ASME…` (ช่อง Fluid code ต่อไลน์) ใน title block / line list / CSV, ช่อง From/To ต่อไลน์ (แสดงใต้ title block), weld list บนแผ่น iso, จุดท่อชนรายงานตรงจุดตัดจริงพร้อมลูกบอลแดงใน 3D, ตั้งความสูงทั้งชุดท่อด้วยช่องเดียว (inspector → Move, copy, mirror)

## ยังไม่ได้ทำ / ไอเดียต่อ
0. (ทำแล้ว 20 ต.ค.) Custom parts เฟส 2 ดูข้างบน; ที่ยังไม่ทำ: รูปภาพของอุปกรณ์ยังไม่ถูกวาดบนแผ่น iso (เก็บไว้และโชว์ในแผงเท่านั้น), รูปทรงมีแค่กล่องกับถังตั้ง (ไม่มีถังนอน/หัวโค้ง/ขา), nozzle ไม่มีหน้าแปลนบอกชนิด
1. **ลองใช้บน iPad จริง** แล้วจดจุดที่ไม่สะดวก (สำคัญสุด)
2. (ทำแล้ว 20 ต.ค.) line designation + weld list
3. (ทำบางส่วน 20 ต.ค.) File → Export BOM by line (.csv) แยกรายการวัสดุต่อไลน์ แต่ class/วัสดุต่อไลน์ยังเป็นข้อความ ไม่ได้เปลี่ยนตาราง fitting
4. (ทำแล้ว 22 ต.ค.) วาดจากมุมมอง Front/Right/Back/Left: แตะแล้วได้ความสูงด้วย บนระนาบตั้งที่ผ่านจุดสุดท้ายของรัน (หรือกลางภาพถ้ายังไม่เริ่มรัน) ใช้กับ Pipe, Measure, Equipment; ยังไม่ได้ลองบน iPad จริง
5. (ทำแล้ว 20 ต.ค.) ไฮไลต์จุดท่อชน
6. (โลโก้ทำแล้ว 22 ต.ค.: Options → Title block → Choose a logo picture เก็บในไฟล์โปรเจกต์ ไม่ขึ้น repo; ย่อเหลือ 320 px ไม่เกิน ~40 KB; Remove ได้; ออกใน PDF) ช่อง from/to ทำแล้ว, แผ่น iso สูงอย่างน้อยเท่าสัดส่วน A3 1200x849 แล้ว; ยังไม่มีตัวเลือก A4/A2)
7. ปรับรูปสัญลักษณ์ iso รายตัวถ้าไม่เหมือนที่คุ้น (บอกชื่อชนิดได้)
8. ตรวจ stress / clash กับโครงสร้างเหล็กและ support (ยังไม่มี; clash กับวาล์วทำแล้ว 20 ต.ค.)

## ข้อควรระวัง
- **ตัวเลข JIS 10K / EN PN16 (OD, หน้าแปลน, สลัก, ชื่อวัสดุ) เขียนจากความจำ ยังไม่ตรวจกับมาตรฐานจริง** อย่าใช้สั่งซื้อ ความยาววาล์ว/tee/reducer ใช้ตาราง ASME ทุกชุด
- ถ้ามีตาราง piping class ของบริษัท ส่งให้ Claude เพื่อแทนที่ตัวเลข
- ข้อมูลโปรเจกต์อยู่ใน Safari ของ iPad (และ backup ในที่เดียวกัน) ถ้าล้างข้อมูลเว็บจะหาย **ให้ File → Save project (.json) เก็บไว้ใน Files/iCloud เป็นระยะ**
- repo และลิงก์เป็นสาธารณะ: ห้ามใส่ข้อมูลหรือสัญลักษณ์ของ Autodesk/Plant 3D, ตาราง spec ของบริษัท หรือข้อมูลลับลงใน repo (รอบนี้เคยดึงสัญลักษณ์ Plant 3D มาแล้วถอนออก ใช้ชุดที่วาดเองแทน)
- ประสิทธิภาพ: ห้ามเพิ่มพื้นผิวโปร่งใสขนาดใหญ่หรืออัปโหลด texture ทุกครั้งที่ปากกาขยับ (เคยทำกริดความสูงแล้วช้า จึงเอาออก)

- วาดรูปร่างอุปกรณ์เอง (custom equipment): `parts` ได้ 12 ชิ้น (box / cyl ตั้ง / cyl แนว X / cyl แนว Y / sph) มี preview 3D ในแผง; outline (box/cyl หลัก) ยังเป็นขนาดที่ใช้ตรวจ clash และวาดบน iso, ซ่อนได้ด้วย `hide`.

- วาดอุปกรณ์เอง: ลากชิ้นส่วนบน preview ได้ (ข้าม / ขึ้น-ลง, snap 10 mm, แตะ S1.. เพื่อเลือก), iso วาดรูปที่ประกอบแล้ว (boxPrim/cylPrim/domePrim ต่อชิ้น).

- Custom equipment preview: ลูกศร X/Y/Z ย้ายตามแกน + จุดจับสีขาวยืดขนาดทีละหน้า (หน้าตรงข้ามคงที่) — รอบแรกของแนว "เหมือน Plant 3D" (เฟส 1). เฟสต่อไป: วางอุปกรณ์/ท่อด้วย gizmo ใน view หลัก, piping spec/catalog, iso อัตโนมัติ. ห้ามใช้ข้อมูล/สัญลักษณ์ Autodesk.

- เฟส 2 (20 ต.ค.): ย้ายอุปกรณ์ที่วางแล้วด้วยลูกศร X/Y/Z ในหน้าจอหลัก (Select), ท่อที่วิ่งตามแนวการย้ายตามไปด้วย ที่เหลืออยู่กับที่และแจ้งจำนวนปลายท่อที่หลุด nozzle.

- เฟส 3 (21 ต.ค.): Piping class (spec) — ⋯ → Line list → Piping classes: สร้างจากแม่แบบ (CS 150#, SS316L 150#, Galvanised threaded) หรือว่าง; ตั้ง schedule/ช่วงขนาด/วาล์วที่ห้ามใช้/ข้อความวัสดุ; กำหนดให้แต่ละไลน์ (คอลัมน์ Piping class) -> pipe ในไลน์ใช้ schedule ของ class, designation ใช้ code, BOM แผ่น iso/BOM by line ใช้วัสดุของ class, เตือนเมื่อขนาด/schedule/วาล์วไม่ตรง class. ขนาดหน้าแปลนยังตามมาตรฐานโปรเจกต์ (class 150 เท่านั้น); ข้อความวัสดุเป็นค่าทั่วไป ต้องเทียบกับ class ของบริษัท.

- รอบตรวจคุณภาพ (21 ต.ค.): โหลดไฟล์เสียไม่ทำให้แอปค้างอีก (normalize ตรวจทุกรายการ, rebuild ก่อนบันทึก, boot guard เก็บสำเนา `pipedraft.broken.v1`), ชื่อไลน์ชนชื่อ object ถูกเปลี่ยน, CSV กันสูตร (csvq), ย้ายอุปกรณ์พาหน้าแปลนปลายท่อไปด้วยและเตือนเมื่อวาล์ว/ซัพพอร์ตหลุดท่อ, Undo/Redo (ปุ่ม + Cmd+Shift+Z), Top view ไม่เกิดท่อตั้ง 25 ม., หน้า Line list/Cut list/Backups มีเลย์เอาต์, ปุ่ม ⋯ ไม่หลุดจอแคบ, พิมพ์ในช่อง custom แล้วไม่เสีย focus, hostOf เร็วขึ้น, BOM by line rebuild ครึ่งหนึ่ง.

- Iso sheet (21 ต.ค.): chain dimension ผ่านวาล์ว/ชิ้นส่วน/ซัพพอร์ต/เครื่องมือวัด + ระยะรวมชั้นนอก, ท่อสั้นมีลูกศรด้านนอก, ป้ายหาที่ว่างกว้างขึ้น (ไม่ซ้อนกัน), tag อุปกรณ์/nozzle เข้า layout, EL บนท่อแนวนอน, connection note "TO P-1/N2" และ "CONT. <line>", north arrow, cut/weld list เคียงข้าง + หัวคอลัมน์ + * เกิน 6 ม., SHEET/SCALE ใน title block. ยังค้าง: A3 คงที่ + overflow, revision block, coordinates, break symbol เส้นยาว, หลายแผ่น.

- Iso (22 ต.ค.): ย่อท่อยาวบนแผ่น iso (ช่องว่างระหว่างปลายท่อตามแกนใดเกิน 2.5 ม. เหลือ 2.5 ม. + 1/5 ของส่วนเกิน, ตัวอุปกรณ์ไม่ถูกย่อ) พร้อม break mark บนท่อที่สั้นกว่าสเกลจริงชัดเจน วางในช่วงที่ไม่มีวาล์ว/ซัพพอร์ต; ตัวเลขระยะยังเป็นความยาวจริง; ปิดได้ที่ Options → Shorten long pipes; หมายเหตุใต้แผ่นบอกว่ามีการย่อ. ยังค้าง: A3 คงที่ + overflow, หลายแผ่น, โลโก้.

- Iso: revision block (REVISIONS: rev ปัจจุบัน + 3 rev เก่า, กรอกใน iso info), ปุ่ม Coordinates (E/N mm ที่ปลายท่ออิสระ).

- รอบ audit (21 ต.ค.): ปรับขนาดท่อพาวาล์ว/หน้าแปลน/ชิ้นส่วนบนท่อไปด้วย, รันใหม่ที่เริ่มจากปลายท่อสืบทอดขนาด/schedule/line, พิมพ์ตัวเลขเข้ม (1,500 / 1200+300 / ปฏิเสธ 4'6"), ท่อสั้นกว่า 50 มม. ไม่วาด, เตือน: วาล์วหน้าแปลนไม่มีหน้าแปลน / ขนาดไม่ตรงท่อ / ท่อซ้อนกัน / BOM ติดลบ, ตัวอย่างเริ่มต้นมีหน้าแปลนครบ, ปุ่ม BOM แสดงจำนวนคำเตือน + แตะคำเตือนที่ระบุท่อเพื่อเลือก, ชื่อไฟล์ส่งออกจาก project/drawing/rev/วันที่, เตือนให้เก็บสำเนานอก Safari.

- Pipe inspector: Size of the whole run + Apply schedule and line to the whole run (runPipes = same-size pipes through elbows, stops at tee/nozzle/size change); Line list: rename line number; valve/inline part/support/instrument: เลือกใน Select แล้วลากลูกศรเหลืองเลื่อนตามท่อ (valve พาหน้าแปลนไปด้วย).

- ส่งออก: DXF มี $INSUNITS(มม.)/layer ต่อ line/TEXT tag; PDF ทั้งหมดทุกไลน์ในไฟล์เดียว + เลือก A3/A4; Weld gap ใน Project settings หักจาก cut length; หน้า How to draw (⋯ → Project, เปิดเองครั้งแรก).

- แก้ "จุดขาวค้าง": แตะบนจุดขาว (จุดเริ่มรัน) เพื่อจบรัน/เลือกจุดใหม่; นิ้วแตะแล้วไม่ทิ้ง marker/เส้นนำไว้.

## Pencil workflow (drawing and editing)
- Pencil mode (first Pencil use): fingers move the view, the Pencil places; setting in pipe settings, Input.
- Select: end handles on a pipe (drag to stretch), Pencil box select, Multi, selection panel (move, copy, size, line, delete), quick bar next to the selection, nearest-part picking with tap-again cycling.
- Pipe tool: midpoint and alignment snaps with coloured marker, dots on free ends, ⌫ takes back the last pipe, bigger Finish run.
- Not verified on a real iPad: Pencil drag handles and box select, handle hit sizes (26 px Pencil, 34 finger), quick bar position near screen edges.
- Slide a pipe sideways with arrows, move hand-picked pipes with arrows, Run button. Not verified on a real iPad.
- NDE column per weld, NDE extent per line, insulation drawn dashed on the iso with a note.
- Parts list folds to one chip after a part is picked.
- Rotation ring: drag to any angle for valve handwheels and equipment, or type degrees.
- Rotate mode: a dial from anywhere on the screen, angle shown in the quick bar.
- Inspector is a chip until opened; panels fade while dragging.
- Quick bar docked at the bottom centre.
- Flanged valve is one part on the iso: no weld marks at it (option to show), four flange bars, flanges cast on the valve in 3D.
- View cube replaces the view buttons.

- โมเดล 3D เหมือนของจริงขึ้น (22 ต.ค.): ปั๊ม = ฐานเหล็กราง + anchor bolt, volute, คอดูด/คอส่ง, bearing frame, coupling guard สีเหลือง, มอเตอร์มีครีบ, ฝาครอบพัดลม, terminal box; ถังตั้ง = เส้นผ่าศูนย์กลาง 1 ม. หัวถัง dished บน-ล่าง, ขา 4 ขา + base plate, manway พร้อมฝา, lifting lug, nozzle มีคอยื่นออกมาให้เห็นหน้าแปลน; วาล์ว = gate (bonnet, yoke, rising stem, พวงมาลัย), globe, swing check (ฝา bolt), ball/plug (คันโยก+ด้ามจับ), butterfly (wafer, คันโยก, notch plate), control (yoke, diaphragm actuator, positioner), knife gate, diaphragm. ตำแหน่ง nozzle และขนาดวาล์วไม่เปลี่ยน งานเก่าเปิดได้เหมือนเดิม; แผ่น iso ของถังปรับตาม (ขา, หัวล่าง, manway)

- อุปกรณ์สำเร็จรูปเพิ่ม 3 แบบ (22 ต.ค., Parts → Equipment): ถังนอน (Ø1.2 ม., T/T 3 ม., หัว 2:1, saddle 2 ตัว, manway บน; nozzle เข้าบน NPS 4, ออกล่าง NPS 4, vent NPS 1), ปั๊มแนวตั้ง in-line (ดูด/ส่งอยู่แนวเดียวกัน NPS 4, มอเตอร์ตั้งบน), heat exchanger shell & tube (shell Ø0.6 ม., bonnet หลัง, channel + ฝาเรียบหน้า, saddle 2 ตัว; shell in บน/out ล่าง NPS 4, tube in ล่าง/out บน NPS 3). มีใน 3D, BOM, แท็ก (V/P/E), แผ่น iso, P&ID, ตรวจท่อชนตัวอุปกรณ์. ขนาดเป็นค่าทั่วไป ถ้าต้องการขนาดเฉพาะให้ใช้ Custom equipment

- แก้แผ่น iso (22 ต.ค.): หน้าแปลนที่ประกบวาล์ววาดชิดปลายสัญลักษณ์วาล์วเสมอ (สัญลักษณ์วาล์วมีขนาดบนกระดาษของตัวเอง iso ไม่ตามสเกล) พร้อม balloon และ weld หลังหน้าแปลนเลื่อนตาม; แก้บั๊กจากการย่อท่อยาว (commit 4fb8c62) ที่ทำให้สัญลักษณ์วาล์ว/หน้าแปลน/ชิ้นส่วนสั้นผิดสัดส่วนประมาณ 13% ตามแนวท่อ และทิศลูกศรเหนือ/แกนอาจเพี้ยน

- สัญลักษณ์วาล์วบน iso ตามตารางอ้างอิงที่ผู้ใช้ส่งมา (22 ต.ค., แบบ Symbols): ปลายวาล์วตามชนิดการต่อ = butt weld มีจุดเชื่อมที่ปลายสัญลักษณ์, socket weld มีขีด socket (ไม่มีจุด), threaded มีขีดเฉียง, flanged มีแท่งหน้าแปลนข้างละ 1 แท่ง (แบบ Pictures ยังมี 2); globe = ลูกกลมทึบไม่มีก้าน, ball = วงกลมมีกากบาท, plug = ก้านหักเป็นธง, needle = สามเหลี่ยมทึบด้านบน, butterfly = จานเฉียงมีจุดระหว่างหน้าแปลน, diaphragm = โดมคลุมตัววาล์ว; gate, check, control คงรูปเดิมที่ตรงกับตารางอยู่แล้ว. ยังไม่ได้ทำ PSV ตามตาราง (ใช้รูปเดิม)
- ปรับสัญลักษณ์รอบ 2 ให้ตรงตารางมากขึ้น: bow-tie สูงเกือบเท่าความกว้าง, แท่งหน้าแปลนสูงกว่าตัววาล์วและเว้นช่องเล็กน้อย (วาดอยู่ในสัญลักษณ์วาล์ว จึงสเกลตามกัน), จุด butt weld อยู่นอกปลายวาล์ว, ขีด socket เป็นสองเส้นบนท่อ, butterfly จานเอียงแบบตาราง, check แบบ butt weld ไม่มีแท่งปลาย, เพิ่มสัญลักษณ์ PSV แบบตาราง

- ลากย้ายป้ายบนแผ่น iso (23 ต.ค.): Options → Move labels แล้วลาก balloon, เลข weld, แท็ก, EL, ป้าย spool และเส้นบอกระยะ (ลากได้เฉพาะแนวตั้งฉากกับท่อ) ด้วยนิ้ว Pencil หรือเมาส์; นิ้วเดียวบนที่ว่างเลื่อนแผ่น สองนิ้วซูม; ตำแหน่งจำต่อแผ่น (ไลน์ + มุมมอง) และ save ไปกับโปรเจกต์; Undo label move / Reset labels on this sheet; ป้ายที่ย้ายแล้วยังคงที่เมื่อเพิ่มท่อที่อื่น (สเกลเปลี่ยน) แต่ถ้าชิ้นส่วนนั้นถูกย้าย ป้ายกลับไปวางอัตโนมัติ. ทดสอบเมาส์ + touch ใน Chromium; ยังไม่ได้ลองบน iPad จริง
- แก้หน้าแปลนข้างวาล์วบน iso (23 ต.ค.): แบบ Pictures หน้าแปลนท่อวางชิดนอกหน้าแปลนของตัววาล์ว (ประกบกันแบบของจริง) ไม่ทับรูปวาล์ว และเอาแท่งซ้ำที่เคยเลื่อนเข้าไปในตัววาล์วออก; แบบ Symbols แท่งหน้าแปลนห่างจากปลาย bow-tie ชัดขึ้น (FL_GAP_S = 4 หน่วย)
- แก้ตำแหน่ง weld บน iso (23 ต.ค.): จุดเชื่อมไม่ตกในวาล์ว/หน้าแปลน/inline item อีก — butterfly และ knife gate (หน้าแปลนสองข้างอยู่ใกล้กัน เดิมจับคู่ผิดข้าง), coupling, union, nipple, steam trap, rupture disc, spectacle, orifice, hose (สัญลักษณ์วาดใหญ่กว่าสเกลจริง weld จึงเลื่อนไปปลายสัญลักษณ์), แบบ Pictures จุดเชื่อมอยู่นอกปลายรูปวาล์ว; มีเทสต์กวาดทุกชนิดวาล์ว 13 x ปลาย 3 แบบ + item 14 ชนิด ทั้งสองสไตล์
- แบบ Pictures (23 ต.ค.): รูปวาล์วมีหน้าแปลนเฉพาะวาล์ว flanged/wafer; วาล์วปลายเชื่อม (BW/SW) และเกลียวไม่มีหน้าแปลน จุดเชื่อมชิดตัววาล์ว
- เก็บรายละเอียดแผ่น iso (23 ต.ค.): weld list/cut list อยู่ในขอบแผ่น, กรอบ revision ไม่ทับเส้นล่าง, หมายเหตุนับ weld ตรงกับรายการ (บอกจำนวนที่ซ่อนที่หน้าแปลนวาล์ว), เส้นบอกระยะวางหลังสัญลักษณ์ทั้งหมดจึงไม่ทับวาล์ว/เครื่องมือวัด, ระยะย่อยในโซ่วัดต้องกว้างพอใส่ตัวเลข (ไม่ซ้อนกัน), เส้น extension ของระยะเป็นสิ่งกีดขวางของป้าย, เส้นนำของป้ายข้อความหยุดที่ขอบข้อความ (ไม่ขีดทับตัวอักษร), หน้าแปลนสองข้างของวาล์วใช้ balloon เดียวสองเส้นนำ, เส้นบอกระยะหลีกเลี่ยงรูปอุปกรณ์
- แผ่น iso สะอาดขึ้น (23 ต.ค.): (1) Stretch crowded pipes — ท่อสั้นที่มีวาล์ว/ชิ้นส่วนหลายชิ้นถูกยืดบนกระดาษให้พอวาง ทีละแกน (แนวตั้งก่อน) ไม่ให้สเกลรวมลดต่ำกว่า 85% ตัวเลขระยะยังเป็นค่าจริง ปิดได้ใน Options; (2) Balloons: tidy (ค่าเริ่มต้น) หน้าแปลน ซัพพอร์ต ข้อต่อ มี balloon ครั้งเดียวต่อเลขรายการต่อแผ่น วาล์ว/อุปกรณ์/item ยังมีทุกตัว, หรือ every part; (3) น้ำหนักเส้น: ท่อหนาขึ้น, เส้นบอกระยะ เส้นนำ และอุปกรณ์เป็นสีเทาบางลง
- วาล์วหน้าแปลนที่ปลายท่อ (23 ต.ค.): วางที่ปลายท่อเปล่ามีหน้าแปลนฝั่งท่อ 1 ตัว (ถูกต้อง อีกฝั่งเป็นหน้าแปลนของตัววาล์วเอง) และมี toast บอก; แก้บั๊ก: วาดท่อต่อออกจากหน้าวาล์วแล้วไม่มีหน้าแปลนคู่ — ตอนนี้เพิ่มหน้าแปลน + ปะเก็น + น็อตให้อัตโนมัติ (fitValveFlanges ใน addPipe), ตัดความยาวท่อใน cut list, มีรอยต่อ bolt ใน cut list, iso จับคู่กับวาล์วถูกต้อง

## ISO 6412-2 check of the iso sheet
- Done: offset triangles with bracketed true length, crossing gaps, slope triangle, reducer size label, false break mark on off-axis pipes removed, `depth3` paint order fixed (equipment pictures were painted near to far).
- Done next: EL shoulder, "CONT. ON <drawing>" with per-line drawing numbers, field fit weld (FFW) with a cut allowance.

## รอบตรวจ 23 ต.ค. (หาจุดปรับปรุง)
- แก้: เกจบนท่อตั้งเคยวาดทับวาล์วบน iso (ก้านชี้ขึ้นตามท่อ) ตอนนี้ยื่นออกด้านข้างเหมือนใน 3D
- แก้: ไฟล์ที่ท่อแยกปลายไปแตะกลางท่ออื่นโดยไม่ได้ตัดท่อ เคยไม่มี olet/tee และ weld ใน BOM เลย ตอนนี้ตัดให้ตอนเปิดไฟล์ และ Check เตือนถ้าเกิดจากการแก้ภายหลัง
- แก้: แผ่น iso รายไลน์ที่มีไลน์อื่นแยกออก เคยหาย olet/tee และขึ้น weld ปลอมกลางท่อ ตอนนี้มีท่อสั้นเส้นประของไลน์อื่น + CONT. ON, fitting นับในไลน์เดียว (BOM by line ไม่ซ้ำ)
- ทำแล้ว: แผ่น iso เป็น A3 เสมอ รายการที่ล้นไปแผ่นต่อ (SHEET 1 OF n) แบ่งคอลัมน์, PDF/Print หน้าละแผ่น, SVG รวมเป็นไฟล์เดียว
- ทำแล้ว: เลือกด้านวางมิติโดยคิดทั้ง chain + เส้นรวมชั้นนอก + เส้น extension ที่พาดผ่านท่อ/สัญลักษณ์/อุปกรณ์
- ทำแล้ว: โมเดลปั๊มใหม่ (end suction แบบ bare shaft ไม่มีมอเตอร์) ทั้ง 3D และรูปบน iso, BOM เขียน driver not included
- ค้าง: ยังไม่ลองบน iPad จริง

- (23 ต.ค.) การระบุระยะบน iso ตามแบบอ้างอิงของเจ้าของ: เส้น extension ตามแกน iso, ตัวเลขเอียงในระนาบเดียวกันอยู่เหนือเส้นที่ไม่ขาด, ลูกศรเรียว, ท่อตรงที่ผ่าน tee เป็น chain เดียวพร้อมระยะรวม, FFW เขียน 2220(+100)
- (23 ต.ค.) แบบ iso ที่รกเกินไปแยกเป็นหลายแผ่นอัตโนมัติ (Options → New sheet when crowded): ตัดเป็นช่วงต่อเนื่อง มี CONT. ON SHEET n ที่รอยต่อ เลข weld/spool ตามทั้งแบบ fitting ที่รอยต่อนับแผ่นเดียว; แก้บั๊ก field weld หายในแผ่นรายไลน์
- (24 ต.ค.) วัสดุท่อหลายชนิด: เหล็กกล้า (CS, LTCS), สแตนเลส 304L/316L, Duplex 2205, Alloy C-276, ไทเทเนียม Gr.2, เหล็กอาบสังกะสี (เกลียว), PVC-U, CPVC, HDPE PE100 (SDR 11), PP-H, PVDF, FRP เลือกได้ต่อท่อ (Pipe settings, inspector, เลือกหลายท่อ, ทั้งไลน์, หรือผ่าน piping class) มีผลกับคำอธิบายและมาตรฐานใน BOM, ชนิดรอยต่อ (butt fusion, solvent cement, lamination, เกลียว), น้ำหนัก, ความขรุขระใน hydraulics, title block และหมายเหตุของ iso, คอลัมน์ Material ใน line list, เตือนเมื่อวัสดุต่างกันมาชนกันโดยไม่มีหน้าแปลน, สีท่อตามวัสดุใน ⋯ ข้อความมาตรฐานเป็นค่าทั่วไป ต้องเทียบกับ piping class จริง
- ค้าง: ขนาดท่อพลาสติกยังใช้ OD ของ NPS (ตรงกับ PVC ASTM D1785 และ HDPE IPS แต่ PP/PVDF จริงเป็น OD เมตริก), ขนาดหน้าแปลนและฟิตติ้งยังเป็นของเหล็ก
- Lowest level under the floor (project spec), for pits and trenches.
- PVC and FRP joints are J with a diamond, not W with a dot.

## Piping, what is left (as of 2026-10-28)
- Done: plastic valves to NPS 2 are socket or fusion ended (`endType(kind, n, e, pt)` looks at the pipe under `pt`), open-end warning on lines that have a class, plastic flange and gasket rows, support spans and temperature limits per material, thermal growth, dead leg, NDE limits on plastic, bonded joints as J.
- Not done: pressure rating of PVC and similar by schedule or SDR and temperature (needs a real table), plastic fitting and flange dimensions (steel tables still used; PP and PVDF OD still NPS), span check on vertical pipe, general reducer orientation rules, automatic drain and vent at low and high points (needs fluid data), take-out table from the owner's company (needs their file), Thai UI.
- Not verified on a real iPad: every touch and Pencil interaction listed under the Pencil workflow.

## Steel in the same app (2026-10-28)
Structural work now lives in this app: Parts, Steel (columns, beams), ⋯, Project, Steel (pipe rack, support frames under equipment, base plates, equipment layout with maintenance clearance, list), Sheets, Steel drawing (plan, elevations, sections). Pipes running into steel are reported in Check. Source in `src/steel.part.js` and `src/steel.ui.part.js`. Not verified on a real iPad. Not done: hidden lines, connection details, strength checks, steel on the iso sheets and P&ID.
- (31 ต.ค.) เพิ่ม Plate heat exchanger (แบบปะเก็น, frame plate มี 4 หัวต่อ NPS 4 ด้านหน้า, plate pack, pressure plate, carrying/guide bar, เสาท้าย, สลักรัด) ใน Parts → Equipment ทั้ง 3D, iso, P&ID (E-x), BOM และ clash; ขนาดเป็นค่าทั่วไป ไม่ใช่รุ่นของผู้ผลิต
