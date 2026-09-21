<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Additive refinement of Figure 4.7 after the supervisor walkthrough.
 *
 * Three groups of columns, all nullable, none of them derived:
 *
 *  1. staff_user.phone / staff_user.address — the Circle Supervisor records a teacher's
 *     full contact details when registering them (FR20). They describe the staff user and
 *     nothing else, so third normal form is unaffected.
 *
 *  2. student.guardian_phone / student.address / student.age — the guardian's number is what
 *     makes FR15 deliverable: the teacher hands the exported PDF to the parent over WhatsApp.
 *     The parent still has no account and stays outside the system boundary of Figure 1.1;
 *     this is a delivery channel for an export, not a parent portal.
 *
 *  3. student.access_code_issued_at — supports the "one easy code per month" rule. The code
 *     itself stays single-purpose and revocable (NFR3); this column only records when it was
 *     last rotated so the UI can say when the next rotation is due instead of the teacher
 *     regenerating a code on every login.
 *
 * access_code widens from CHAR(8) to VARCHAR(12) so a short, memorable code (LLLDDD) and the
 * existing eight-character codes can coexist. UNIQUE is preserved.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('staff_user', function (Blueprint $t) {
            $t->string('phone', 24)->nullable()->after('email');
            $t->string('address', 200)->nullable()->after('phone');
        });

        Schema::table('student', function (Blueprint $t) {
            $t->string('guardian_phone', 24)->nullable()->after('name');
            $t->string('address', 200)->nullable()->after('guardian_phone');
            $t->unsignedTinyInteger('age')->nullable()->after('address');
            $t->dateTime('access_code_issued_at')->nullable()->after('access_code');
        });

        // CHAR(8) → VARCHAR(12). doctrine/dbal is not installed, so this is raw DDL;
        // sqlite (tests) stores the column as TEXT already and needs no change.
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE student MODIFY access_code VARCHAR(12) NOT NULL');
            DB::statement('ALTER TABLE student ADD CONSTRAINT chk_student_age CHECK (age IS NULL OR age BETWEEN 3 AND 99)');
        }

        // Existing rows keep their codes; backdate the rotation clock so the first
        // renewal prompt appears at the next scheduled rotation rather than immediately.
        DB::table('student')->whereNull('access_code_issued_at')->update(['access_code_issued_at' => now()]);
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE student DROP CONSTRAINT chk_student_age');
            DB::statement('ALTER TABLE student MODIFY access_code CHAR(8) NOT NULL');
        }
        Schema::table('student', function (Blueprint $t) {
            $t->dropColumn(['guardian_phone', 'address', 'age', 'access_code_issued_at']);
        });
        Schema::table('staff_user', function (Blueprint $t) {
            $t->dropColumn(['phone', 'address']);
        });
    }
};
