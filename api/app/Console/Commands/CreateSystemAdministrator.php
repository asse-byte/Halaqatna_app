<?php

namespace App\Console\Commands;

use App\Models\Role;
use App\Models\StaffUser;
use App\Services\AuditLogger;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * An additional System Administrator (FR19), for a deployment run by more than one person.
 *
 * The screens deliberately offer no way to create one: a System Administrator creates circles
 * and their supervisors only. The seeded administrator comes from SYS_ADMIN_EMAIL; any other
 * is created here, by whoever can run commands on the server.
 *
 *   docker compose exec api php artisan halaqtna:create-sys-admin someone@example.org --name="Name"
 *
 * The password is generated and printed once. It is never stored anywhere but its hash, so
 * hand it over privately and have it changed on "My account" at the first sign-in.
 */
class CreateSystemAdministrator extends Command
{
    protected $signature = 'halaqtna:create-sys-admin {email : Sign-in address} {--name= : Display name (defaults to the part before @)}';

    protected $description = 'Create an additional System Administrator with a one-time random password';

    public function handle(AuditLogger $audit): int
    {
        $email = strtolower(trim((string) $this->argument('email')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 160) {
            $this->error("'{$email}' is not a valid email address.");
            return self::FAILURE;
        }
        if (StaffUser::where('email', $email)->exists()) {
            $this->error("An account with {$email} already exists. Nothing was changed.");
            return self::FAILURE;
        }
        $roleId = Role::where('code', 'SYS_ADMIN')->value('role_id');
        if (!$roleId) {
            $this->error('The SYS_ADMIN role does not exist. Run the seeder first.');
            return self::FAILURE;
        }

        $name = trim((string) $this->option('name')) ?: Str::before($email, '@');
        // Letters and digits only: nothing a shell, a dotenv file or a careless copy can mangle.
        $password = Str::password(16, true, true, false, false);

        $user = DB::transaction(function () use ($email, $name, $password, $roleId, $audit) {
            $user = StaffUser::create([
                'name' => Str::limit($name, 120, ''), 'email' => $email, 'password_hash' => Hash::make($password),
                'role_id' => $roleId, 'circle_id' => null, 'locale' => 'ar',
            ]);
            // No signed-in actor: the payload records that it came from the server console.
            $audit->anonymous('CREATE', 'staff_user', $user->user_id, ['role' => 'SYS_ADMIN', 'via' => 'console']);

            return $user;
        });

        $this->info("System Administrator created: {$user->email}");
        $this->line("One-time password: {$password}");
        $this->warn('Shown only now. Hand it over privately, and have it changed on "My account" at the first sign-in.');

        return self::SUCCESS;
    }
}
