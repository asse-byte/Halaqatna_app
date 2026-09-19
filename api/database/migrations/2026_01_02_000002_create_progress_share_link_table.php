<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// §2.13 progress_share_link — [BUILD] new in CPIT-499, supports FR21 (see §12 scope-change notice).
return new class extends Migration
{
    public function up(): void
    {
        $check = fn (string $sql) => DB::getDriverName() === 'mysql' ? DB::statement($sql) : null;

        Schema::create('progress_share_link', function (Blueprint $t) {
            $t->increments('link_id');
            $t->unsignedInteger('student_id');
            $t->unsignedInteger('created_by_user_id');          // the teacher
            $t->char('token', 43)->unique();                     // 32 random bytes, base64url — the only credential
            $t->dateTime('expires_at');
            $t->dateTime('revoked_at')->nullable();              // non-null means revoked
            $t->integer('view_count')->default(0);
            $t->dateTime('last_viewed_at')->nullable();
            $t->dateTime('created_at');
            $t->foreign('student_id')->references('student_id')->on('student')->cascadeOnDelete();
            $t->foreign('created_by_user_id')->references('user_id')->on('staff_user')->restrictOnDelete();
        });
        $check('ALTER TABLE progress_share_link ADD CONSTRAINT chk_share_views CHECK (view_count >= 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('progress_share_link');
    }
};
