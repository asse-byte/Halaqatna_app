<?php

namespace Tests\Feature;

use App\Models\Circle;
use App\Models\ErrorType;
use App\Models\StaffUser;
use App\Models\Student;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A deployment real people use must not contain the demo accounts, whose password is
 * published in the README. With SEED_DEMO_DATA off the seeder creates the reference data and
 * the System Administrator and nothing else.
 */
class ProductionSeedTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_demo_data_is_on_unless_a_deployment_turns_it_off(): void
    {
        $this->assertTrue(config('halaqtna.seed_demo_data'));
    }

    public function test_seeding_without_demo_data_creates_only_reference_data_and_the_administrator(): void
    {
        config(['halaqtna.seed_demo_data' => false, 'halaqtna.sys_admin.email' => 'Owner@Example.org', 'halaqtna.sys_admin.password' => 'a-long-random-secret']);

        $this->seed(DatabaseSeeder::class);

        $this->assertSame(0, Circle::count());
        $this->assertSame(0, Student::count());
        $this->assertSame(4, ErrorType::count());
        $this->assertSame(['owner@example.org'], StaffUser::pluck('email')->all());
        $this->assertSame('SYS_ADMIN', StaffUser::first()->load('role')->roleCode());
        $this->assertDatabaseMissing('staff_user', ['email' => 'admin.nafi@halaqtna.sa']);
    }

    public function test_seeding_twice_without_demo_data_is_harmless(): void
    {
        config(['halaqtna.seed_demo_data' => false, 'halaqtna.sys_admin.email' => 'owner@example.org', 'halaqtna.sys_admin.password' => 'a-long-random-secret']);

        $this->seed(DatabaseSeeder::class);
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(1, StaffUser::count());
    }
}
