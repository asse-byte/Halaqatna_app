<?php

namespace App\Services;

use App\Models\AuditLog;

/** Audit Logger — FR18. Insert-only; the DB grant forbids UPDATE/DELETE on audit_log. */
class AuditLogger
{
    public function log(array $actor, string $action, string $entity, ?int $entityId, array $payload = []): void
    {
        if ($actor['type'] === 'student') {
            $payload['actor_student_id'] = $actor['id'];
        }
        $this->write($actor['type'] === 'staff' ? $actor['id'] : null, $action, $entity, $entityId, $payload);
    }

    /**
     * Actions with no authenticated actor: a login lockout (§5.1) and a progress-card
     * view by a link holder (§2.13). The link holder is not a system actor, so
     * actor_user_id is NULL and the payload carries what is known about the caller.
     */
    public function anonymous(string $action, string $entity, ?int $entityId, array $payload = []): void
    {
        $this->write(null, $action, $entity, $entityId, $payload);
    }

    private function write(?int $actorUserId, string $action, string $entity, ?int $entityId, array $payload): void
    {
        AuditLog::create([
            'actor_user_id' => $actorUserId,
            'action' => $action,
            'entity' => $entity,
            'entity_id' => $entityId,
            'payload_json' => $payload,
            'created_at' => now(),
        ]);
    }
}
