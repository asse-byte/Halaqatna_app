<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Tables in the dependency order of §2 of the CPIT-499 build specification.
return new class extends Migration
{
    public function up(): void
    {
        // CHECK constraints via ALTER are MySQL-only; sqlite (tests) skips them.
        $check = fn (string $sql) => DB::getDriverName() === 'mysql' ? DB::statement($sql) : null;
        // 2.1 role
        Schema::create('role', function (Blueprint $t) {
            $t->increments('role_id');
            $t->enum('code', ['SYS_ADMIN', 'CIRCLE_ADMIN', 'TEACHER'])->unique();
            $t->string('label', 60);
        });

        // 2.2 circle
        Schema::create('circle', function (Blueprint $t) {
            $t->increments('circle_id');
            $t->string('name', 120);
            $t->string('location', 160)->nullable();
            $t->time('schedule_time')->nullable();
        });

        // 2.3 staff_user
        Schema::create('staff_user', function (Blueprint $t) {
            $t->increments('user_id');
            $t->string('name', 120);
            $t->string('email', 160)->unique();
            $t->char('password_hash', 60);
            $t->unsignedInteger('role_id');
            $t->unsignedInteger('circle_id')->nullable();
            $t->enum('locale', ['ar', 'en'])->default('ar');
            $t->boolean('is_active')->default(true);
            $t->foreign('role_id')->references('role_id')->on('role')->restrictOnDelete();
            $t->foreign('circle_id')->references('circle_id')->on('circle')->nullOnDelete();
        });

        // 2.4 student — no email, no password_hash (deliberate)
        Schema::create('student', function (Blueprint $t) {
            $t->increments('student_id');
            $t->string('name', 120);
            $t->char('access_code', 8)->unique();
            $t->unsignedInteger('circle_id');
            $t->unsignedTinyInteger('current_juz')->default(1);
            $t->enum('locale', ['ar', 'en'])->default('ar');
            $t->boolean('is_active')->default(true); // [BUILD] needed for FR20 "suspend students"
            $t->foreign('circle_id')->references('circle_id')->on('circle')->restrictOnDelete();
        });
        $check('ALTER TABLE student ADD CONSTRAINT chk_student_juz CHECK (current_juz BETWEEN 1 AND 30)');

        // 2.5 student_teacher
        Schema::create('student_teacher', function (Blueprint $t) {
            $t->unsignedInteger('student_id');
            $t->unsignedInteger('user_id');
            $t->primary(['student_id', 'user_id']);
            $t->foreign('student_id')->references('student_id')->on('student')->cascadeOnDelete();
            $t->foreign('user_id')->references('user_id')->on('staff_user')->cascadeOnDelete();
        });

        // 2.6 error_type
        Schema::create('error_type', function (Blueprint $t) {
            $t->increments('error_type_id');
            $t->enum('code', ['MEM_GAP', 'LNK_ERR', 'TAJ_ERR', 'SLF_CRT'])->unique();
            $t->string('label_ar', 60);
            $t->string('label_en', 60);
            $t->decimal('weight', 3, 2);
        });
        $check('ALTER TABLE error_type ADD CONSTRAINT chk_error_weight CHECK (weight BETWEEN 0 AND 1)');

        // 2.7 session
        Schema::create('session', function (Blueprint $t) {
            $t->increments('session_id');
            $t->unsignedInteger('student_id');
            $t->unsignedInteger('user_id');
            $t->date('session_date');
            $t->smallInteger('surah_from')->nullable();
            $t->smallInteger('ayah_from')->nullable();
            $t->smallInteger('surah_to')->nullable();
            $t->smallInteger('ayah_to')->nullable();
            $t->decimal('pages_memorized', 4, 2)->default(0);
            $t->enum('attendance_status', ['P', 'A', 'L', 'E']);
            // [BUILD] I2 decision for §3.7 review depth — changes Figure 4.7 (see README §11)
            $t->enum('session_type', ['NEW', 'REVIEW', 'MIXED'])->default('NEW');
            $t->unique(['student_id', 'session_date']);
            $t->foreign('student_id')->references('student_id')->on('student')->cascadeOnDelete();
            $t->foreign('user_id')->references('user_id')->on('staff_user')->restrictOnDelete();
        });
        $check('ALTER TABLE session ADD CONSTRAINT chk_session_pages CHECK (pages_memorized >= 0)');

        // 2.8 session_error — no weight column (3NF)
        Schema::create('session_error', function (Blueprint $t) {
            $t->increments('error_id');
            $t->unsignedInteger('session_id');
            $t->unsignedInteger('error_type_id');
            $t->string('ayah_ref', 16)->nullable();
            $t->foreign('session_id')->references('session_id')->on('session')->cascadeOnDelete();
            $t->foreign('error_type_id')->references('error_type_id')->on('error_type')->restrictOnDelete();
        });

        // 2.9 prediction — many rows per student, never overwritten
        Schema::create('prediction', function (Blueprint $t) {
            $t->increments('prediction_id');
            $t->unsignedInteger('student_id');
            $t->date('predicted_completion_date')->nullable();
            $t->smallInteger('eta_days');
            $t->string('model_version', 20);
            $t->dateTime('generated_at');
            $t->foreign('student_id')->references('student_id')->on('student')->cascadeOnDelete();
        });
        $check('ALTER TABLE prediction ADD CONSTRAINT chk_prediction_eta CHECK (eta_days >= 0)');

        // 2.10 badge / student_badge
        Schema::create('badge', function (Blueprint $t) {
            $t->increments('badge_id');
            $t->string('name_ar', 80);
            $t->string('name_en', 80);
            $t->enum('condition_type', ['PAGES_TOTAL', 'SESSIONS_ATTENDED', 'MASTERY_MIN', 'XP_TOTAL', 'STREAK_SESSIONS']);
            $t->integer('condition_value');
        });
        $check('ALTER TABLE badge ADD CONSTRAINT chk_badge_value CHECK (condition_value > 0)');

        Schema::create('student_badge', function (Blueprint $t) {
            $t->unsignedInteger('student_id');
            $t->unsignedInteger('badge_id');
            $t->dateTime('earned_at');
            $t->primary(['student_id', 'badge_id']);
            $t->foreign('student_id')->references('student_id')->on('student')->cascadeOnDelete();
            $t->foreign('badge_id')->references('badge_id')->on('badge')->cascadeOnDelete();
        });

        // 2.11 challenge / student_challenge
        Schema::create('challenge', function (Blueprint $t) {
            $t->increments('challenge_id');
            $t->string('title_ar', 120);
            $t->string('title_en', 120);
            $t->integer('target_value');
            $t->smallInteger('duration_days');
            $t->integer('xp_reward');
        });
        $check('ALTER TABLE challenge ADD CONSTRAINT chk_challenge_xp CHECK (xp_reward >= 0)');

        Schema::create('student_challenge', function (Blueprint $t) {
            $t->unsignedInteger('student_id');
            $t->unsignedInteger('challenge_id');
            $t->enum('status', ['ACTIVE', 'COMPLETED', 'EXPIRED'])->default('ACTIVE');
            $t->integer('progress')->default(0);
            $t->dateTime('started_at');
            $t->dateTime('completed_at')->nullable();
            $t->primary(['student_id', 'challenge_id']);
            $t->foreign('student_id')->references('student_id')->on('student')->cascadeOnDelete();
            $t->foreign('challenge_id')->references('challenge_id')->on('challenge')->cascadeOnDelete();
        });
        $check('ALTER TABLE student_challenge ADD CONSTRAINT chk_challenge_progress CHECK (progress >= 0)');

        // 2.12 xp_ledger — APPEND ONLY (enforced by DB grants, see scripts/db_grants.sql)
        Schema::create('xp_ledger', function (Blueprint $t) {
            $t->increments('entry_id');
            $t->unsignedInteger('student_id');
            $t->unsignedInteger('session_id')->nullable();
            $t->integer('points');
            $t->enum('reason', ['PAGE_MEMORIZED', 'SESSION_ATTENDED', 'CHALLENGE_COMPLETED', 'BADGE_EARNED', 'ADJUST']);
            $t->dateTime('created_at');
            $t->foreign('student_id')->references('student_id')->on('student')->cascadeOnDelete();
            $t->foreign('session_id')->references('session_id')->on('session')->nullOnDelete();
        });

        // 2.13 audit_log — APPEND ONLY
        Schema::create('audit_log', function (Blueprint $t) {
            $t->bigIncrements('log_id');
            // [BUILD] nullable so student self-service actions (UC23) can be audited; payload carries actor_student_id
            $t->unsignedInteger('actor_user_id')->nullable();
            $t->enum('action', ['CREATE', 'UPDATE', 'DELETE', 'ADJUST', 'VIEW']); // VIEW required by §2.13 (share-card views)
            $t->string('entity', 40);
            $t->unsignedInteger('entity_id')->nullable();
            $t->json('payload_json')->nullable();
            $t->dateTime('created_at')->useCurrent();
            $t->foreign('actor_user_id')->references('user_id')->on('staff_user')->restrictOnDelete();
        });

        // [BUILD] UC3 configure system settings — holds the provisional constants for calibration
        Schema::create('system_setting', function (Blueprint $t) {
            $t->string('setting_key', 40)->primary();
            $t->string('setting_value', 120);
            $t->string('description', 160)->nullable();
        });
    }

    public function down(): void
    {
        foreach (['system_setting', 'audit_log', 'xp_ledger', 'student_challenge', 'challenge', 'student_badge', 'badge',
            'prediction', 'session_error', 'session', 'error_type', 'student_teacher', 'student', 'staff_user', 'circle', 'role'] as $tbl) {
            Schema::dropIfExists($tbl);
        }
    }
};
