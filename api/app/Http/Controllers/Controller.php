<?php

namespace App\Http\Controllers;

use App\Services\AuditLogger;
use App\Services\AuthRbacService;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;

abstract class Controller extends BaseController
{
    /**
     * One password policy for every account, whoever sets it (NFR3). bcrypt ignores
     * everything past 72 bytes, so a longer "password" would only look stronger.
     */
    protected const PASSWORD_RULE = 'string|min:8|max:72';

    /** A phone number as people actually type it: digits, +, spaces, brackets and dashes. */
    protected const PHONE_RULE = 'nullable|string|max:24|regex:/^[0-9+\s()-]{6,24}$/';

    public function __construct(protected AuthRbacService $rbac, protected AuditLogger $audit) {}

    protected function actor(Request $r): array
    {
        return $r->attributes->get('actor');
    }

    /**
     * Emails are stored lower-case, so sign-in is case-insensitive. Normalising BEFORE
     * validation keeps the `unique` rule honest on case-sensitive drivers (SQLite): checked
     * after, "Teacher@x.sa" passes validation and then collides with "teacher@x.sa" in the
     * database as a 500 instead of a 422.
     */
    protected function lowercaseEmail(Request $r): void
    {
        if (is_string($r->input('email'))) {
            $r->merge(['email' => strtolower(trim($r->input('email')))]);
        }
    }
}
