<?php

namespace Tests\Feature;

use App\Models\StaffUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

/** FR19 — a second System Administrator is created from the server console, never from a screen. */
class CreateSystemAdministratorTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWorld();
    }

    public function test_it_creates_a_working_system_administrator_with_a_one_time_password(): void
    {
        $code = Artisan::call('halaqtna:create-sys-admin', ['email' => '  Second.Admin@Example.org ', '--name' => 'منذر الفارسي']);
        $this->assertSame(0, $code);
        preg_match('/One-time password: (\S+)/', Artisan::output(), $m);
        $this->assertSame(16, strlen($m[1] ?? ''));

        $user = StaffUser::where('email', 'second.admin@example.org')->firstOrFail();
        $this->assertSame('SYS_ADMIN', $user->load('role')->roleCode());
        $this->assertNull($user->circle_id);
        $this->assertSame('منذر الفارسي', $user->name);

        // The printed password signs in, and the account reaches what a System Administrator reaches.
        $token = $this->postJson('/api/auth/login', ['email' => 'second.admin@example.org', 'password' => $m[1]])->assertOk()->json('token');
        $this->as($token)->getJson('/api/circles')->assertOk();

        $this->assertDatabaseHas('audit_log', ['action' => 'CREATE', 'entity' => 'staff_user', 'entity_id' => $user->user_id, 'actor_user_id' => null]);
    }

    public function test_an_existing_address_is_refused_and_left_untouched(): void
    {
        $before = StaffUser::where('email', 'a1@x.sa')->value('password_hash');

        $this->assertSame(1, Artisan::call('halaqtna:create-sys-admin', ['email' => 'A1@x.sa']));

        $this->assertSame($before, StaffUser::where('email', 'a1@x.sa')->value('password_hash'));
        $this->assertSame(1, StaffUser::where('email', 'a1@x.sa')->count());
    }

    public function test_an_invalid_address_creates_nothing(): void
    {
        $count = StaffUser::count();

        $this->assertSame(1, Artisan::call('halaqtna:create-sys-admin', ['email' => 'not-an-email']));

        $this->assertSame($count, StaffUser::count());
    }
}
