# نشر «حلقتنا» لتجربة حقيقية بتكلفة صفر تقريبًا

يشرح هذا الدليل نشر النظام على خادم افتراضي واحد (Azure for Students) باسم نطاق مجاني (`.me` من Student Pack)، وشهادة HTTPS مجانية من Let's Encrypt. البنية كما في التقرير: أربع حاويات (nginx وapi وml وdb) بلا أي تغيير.

> **ما تحقّقت منه وما لم أتحقّق منه.** صفحة GitHub Student Pack الرسمية (قُرئت في 2026-11-06) تذكر رصيد Azure بقيمة 100 دولار (لمن عمره 18+، دون بطاقة ائتمان)، وسنة من نطاق `.me` عبر Namecheap. **DigitalOcean لم يعد في القائمة.** نُفّذ القسمان 1 و2 فعليًا على خادم حقيقي في 2026-11-07. أما السكربتات في الأقسام التالية فصيغتها مفحوصة واختُبر `prod_init.sh` على نسخة تجريبية، لكنها **لم تُجرَّب بعد على خادم حقيقي**.

## 0. قبل أي شيء: بيانات أطفال حقيقية

التجربة الحقيقية تعني أسماء أطفال وأرقام أولياء أمورهم على خادم في سحابة أجنبية. قبل أن تُدخلوا بيانات حقيقية:

- خذوا **موافقة كتابية** من إدارة الحلقة ومن أولياء الأمور، واكتبوا لهم بوضوح ما يُخزَّن وأين.
- اسألوا الدكتور أحمد والجامعة هل تلزم موافقة أخلاقية، وهل تقيّد أنظمة حماية البيانات الشخصية في المملكة استضافة بيانات الأطفال خارجها. لست مستشارًا قانونيًا ولا أجزم بالجواب.
- أدخلوا أقل ما يلزم: رقم ولي الأمر ضروري فقط لإرسال التقرير عبر واتساب، فاتركوه فارغًا لمن لم يوافق.
- حدّدوا مدة التجربة، وما يحدث للبيانات بعدها (تصدير ثم حذف).

## 1. ما تفعلونه بحسابكم (لا أستطيع إنشاء حسابات)

1. **النطاق:** من education.github.com/pack اطلبوا عرض Namecheap، ثم سجّلوا نطاق `.me` (مجاني سنة، ويتجدد بعدها بسعر عادي). لا تشتروا إضافات.
2. **Azure for Students:** فعّلوه من الصفحة نفسها بحسابكم الجامعي أو GitHub. الرصيد 100 دولار، ولا تُدخلوا بطاقة إن لم يطلب.
3. أنشئوا آلة افتراضية:
   - النظام: **Ubuntu 24.04 LTS**، الحجم: **Standard_B1ms** (ذاكرة 2 جيجابايت؛ أصغر منها لا تكفي MySQL وPython معًا).
   - الدخول بمفتاح **SSH** لا بكلمة مرور.
   - **عنوان IP عام ثابت** (وإلا تغيّر عند إعادة التشغيل وانكسر النطاق).
   - المنطقة: انظروا «اختيار المنطقة» أدناه. لا تكفي رؤية الاسم في القائمة.
   - قواعد الشبكة الواردة: 22 و80 و443 فقط. وتغيير المنطقة في النموذج يصفّرها، فراجعوها قبل الإنشاء.
4. **السعر:** رأينا `B1ms` في منطقة الدنمارك بسعر 0.024 دولار للساعة، أي نحو 17.5 دولارًا شهريًا، ومعه العنوان الثابت والقرص نحو **23 إلى 24 دولارًا** (تقدير للعنوان والقرص). فالرصيد يكفي نحو **أربعة أشهر**، لا سنة. وقد يختلف السعر قليلًا من منطقة لأخرى، فتحقّقوا منه في Cost Management وأنشئوا **تنبيه ميزانية**. الأحجام المجانية (750 ساعة شهريًا) ذاكرتها 1 جيجابايت فقط، ولا تكفي النظام.
5. في Namecheap (Advanced DNS) أضيفوا سجل **A** من `@` إلى عنوان الخادم. تحقّقوا بـ `getent hosts نطاقكم`.

### اختيار المنطقة

على اشتراك الطلاب قيدان منفصلان، ويجب أن يتحققا معًا. نفّذوا الأمرين في Cloud Shell (الأيقونة `>_`):

```bash
# 1) المناطق التي تسمح بها السياسة
az policy assignment list --query "[].{name:displayName, locations:parameters.listOfAllowedLocations.value}" -o json
# 2) أين الحجم متاح (Restrictions = None)
az vm list-skus --resource-type virtualMachines --size Standard_B1ms --all -o table
```

اختاروا منطقة موجودة في **القائمتين**. وإذا كانت في الثانية فقط، فسيفشل الإنشاء بـ `RequestDisallowedByAzure`. في تجربتنا كانت الوحيدة **India South Central**، وقد تختلف القائمة عندكم. والبيانات حينها خارج المملكة، فاذكروا ذلك في نموذج الموافقة (القسم 0).

### إن لم يصل الاتصال إلى الخادم

افحصوا المنفذ من Cloud Shell:

```bash
timeout 8 bash -c '</dev/tcp/عنوان_الخادم/22' && echo OPEN || echo CLOSED
```

**`CLOSED`:** الآلة بلا جدار شبكة، وقد يحدث هذا حتى مع اختيار المنافذ في النموذج. أنشئوه واربطوه (اسم الكرت من صفحة الآلة، ومنطقتكم بدل `indiasouthcentral`). ولا تستخدموا `az vm open-port`، فهو يتعطل عند غياب الجدار:

```bash
az network nsg create -g halaqtna-rg -n halaqtna-vm-nsg -l indiasouthcentral -o none
az network nsg rule create -g halaqtna-rg --nsg-name halaqtna-vm-nsg -n allow-ssh-web --priority 1001 --access Allow --direction Inbound --protocol Tcp --destination-port-ranges 22 80 443 -o none
az network nic update -g halaqtna-rg -n اسم_الكرت --network-security-group halaqtna-vm-nsg -o none
```

**`OPEN` لكن `ssh` من جهازكم يعطي `Connection timed out`:** شبكتكم تحجب المنفذ 22. أديروا الخادم من Cloud Shell بمفتاح مؤقت، وكرروا هذا في كل جلسة جديدة:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/cloudshell -N ""
az vm user update -g halaqtna-rg -n halaqtna-vm -u azureuser --ssh-key-value "$(cat ~/.ssh/cloudshell.pub)" -o none
ssh -i ~/.ssh/cloudshell azureuser@عنوان_الخادم
```

## 2. تجهيز الخادم (مرة واحدة)

ادخلوا بـ `ssh` ثم:

```bash
sudo apt update && sudo DEBIAN_FRONTEND=noninteractive apt -y upgrade
sudo apt -y install docker.io docker-compose-v2 certbot git openssl ufw
sudo usermod -aG docker $USER      # ثم اخرجوا وادخلوا من جديد
# ذاكرة تبديل 2 جيجابايت حتى لا تُقتل MySQL عند ذروة الاستخدام
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
# جدار ناري: افتحوا SSH أولًا وإلا أغلقتم على أنفسكم الباب
sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw --force enable
git clone https://github.com/asse-byte/Halaqatna_app.git && cd Halaqatna_app
```

(إن كان المستودع خاصًا فاستخدموا رمز وصول شخصيًا لا كلمة مروركم.)

## 3. الأسرار (مرة واحدة، قبل أول تشغيل)

```bash
SYS_ADMIN_EMAIL=بريدكم@example.org bash scripts/prod_init.sh نطاقكم.me
```

يولّد كلمات مرور عشوائية ويضعها في `api/.env.docker` و`docker/mysql/init.sql` و`docker/.env`. **انسخوا `docker/.env` إلى مدير كلمات مرور الآن**: ضياعه يعني ضياع الوصول إلى قاعدة البيانات. لا تعيدوا تشغيله بعد إنشاء القاعدة.

## 4. شهادة HTTPS

```bash
sudo certbot certonly --standalone -d نطاقكم.me -m بريدكم@example.org --agree-tos \
  --deploy-hook "bash $PWD/scripts/install_cert.sh" \
  --pre-hook  "docker compose -f $PWD/docker/docker-compose.yml stop nginx || true" \
  --post-hook "docker compose -f $PWD/docker/docker-compose.yml start nginx || true"
sudo certbot renew --dry-run       # يجب أن ينجح؛ فالتجديد تلقائي كل شهرين تقريبًا
```

الموافقة على شروط الخدمة (`--agree-tos`) قراركم أنتم. التجديد يوقف nginx ثوانيَ معدودة.

## 5. بناء الواجهة وتشغيل النظام

```bash
docker run --rm -v "$PWD/frontend":/app -w /app node:22 sh -c "npm ci && npm run build"
bash scripts/docker_setup.sh
```

يبني الصور ويهاجر القاعدة بصلاحيات المدير ويطبّق صلاحيات الحد الأدنى ويتحقق من أن `audit_log` و`xp_ledger` للإضافة فقط، ثم يشغّل الحاويات. **لا يُنشئ حلقات تجريبية** (كلمة مرورها منشورة في README). للعرض التجريبي فقط: `DEMO=1 bash scripts/docker_setup.sh`.

## 6. أول دخول

افتحوا `https://نطاقكم.me`، وادخلوا من صفحة الموظفين ببريد مدير النظام وكلمته من `docker/.env`، وغيّروا الكلمة فورًا من «حسابي». ثم من مدير النظام: أنشئوا الحلقة ومشرفها (FR19)، والمشرف يضيف المعلمين والطلاب ويسلّم كل طالب رمزه.

فحص سريع: لا يظهر أي حساب تجريبي، وتظهر قفلة المتصفح الخضراء، والتوقعات تعمل (تبدأ بنموذج `baseline-0.1` حتى يُدرَّب على بيانات كافية).

**مدير نظام إضافي:** لا تتيحه الشاشات عمدًا. أنشئوه من الخادم، فيطبع كلمة مرور عشوائية مرة واحدة:

```bash
cd ~/Halaqatna_app/docker && docker compose exec api php artisan halaqtna:create-sys-admin البريد@example.org --name="الاسم"
```

سلّموا الكلمة لصاحبها بطريق خاص، وليغيّرها من «حسابي» في أول دخول.

**تثبيت التطبيق (PWA):** الموقع قابل للتثبيت كتطبيق، ويفتح واجهته دون اتصال. ولا تُحفظ بيانات الطلاب على الجهاز، فهي تأتي من الخادم دائمًا، ويحفظ تسجيل الجلسات دون اتصال في طابوره المعتاد حتى يعود الاتصال.
- **Android (Chrome):** القائمة ⋮ ثم **تثبيت التطبيق** (Install app).
- **iPhone وiPad (Safari):** زر المشاركة ثم **إضافة إلى الشاشة الرئيسية**.
- **الكمبيوتر (Chrome أو Edge):** أيقونة التثبيت في شريط العنوان.

## 7. النسخ الاحتياطي (لا تتخطوه)

```bash
bash scripts/backup_db.sh                 # جرّبوه يدويًا مرة
crontab -e                                # ثم أضيفوا:
0 2 * * *  cd $HOME/Halaqatna_app && bash scripts/backup_db.sh >> backups/backup.log 2>&1
```

يحتفظ بآخر 14 نسخة على الخادم. **نسخة على الخادم نفسه ليست نسخة احتياطية**: حمّلوا الأحدث أسبوعيًا إلى جهازكم بـ `scp` واحفظوها مشفّرة، فهي تحوي بيانات الأطفال. جرّبوا الاستعادة مرة قبل الاعتماد عليها (الأمر في رأس السكربت).

## 8. التحديث

```bash
cd ~/Halaqatna_app && bash scripts/backup_db.sh && git pull
docker run --rm -v "$PWD/frontend":/app -w /app node:22 sh -c "npm ci && npm run build"
bash scripts/docker_setup.sh              # آمن للإعادة؛ لا يحذف بيانات
```

إن رفض `git pull` بسبب `api/.env.docker` أو `docker/mysql/init.sql` فهذا لأن الملفين يحملان أسراركم؛ احفظوهما خارج المستودع، وأعيدوا الأصل بـ `git update-index --no-skip-worktree`، ثم اسحبوا، وأعيدوا الأسرار.

## 9. منحنى التعلم من بيانات التجربة (الملاحظة 7)

بعد أسابيع من الجلسات الحقيقية:

```bash
cd docker && docker compose exec ml python learning_curve.py --data-source pilot
docker compose cp ml:/srv/reports ../ml-reports
```

الرسم لا يُصدَّر على أنه من بيانات حقيقية إلا بهذا الوسم، فلا تستخدموه على بيانات تجريبية.

## 10. حدود يجب أن تعرفوها

- خادم واحد: لا تكرار ولا استمرارية عند عطل. الاعتماد على النسخ الاحتياطي.
- ينتهي رصيد Azure فيتوقف الاشتراك. خطّطوا للتصدير قبل ذلك.
- لا مراقبة: راجعوا `docker compose -f docker/docker-compose.yml ps` و`logs` عند أي شكوى.
- تحديثات النظام الأمنية للخادم تحتاج `sudo apt update && sudo apt -y upgrade` شهريًا ثم إعادة تشغيل.
