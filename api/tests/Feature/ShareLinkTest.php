<?php

namespace Tests\Feature;

use App\Models\ProgressShareLink;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * FR21 / UC25 / UC26 — parent progress link. This is the §10 "Parent progress link"
 * checklist, plus the I5 exit tests. The feature publishes a minor's performance data at a
 * URL with no login, so none of these guarantees may be weakened (§12).
 */
class ShareLinkTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWorld();
    }

    private function issue(?string $token = null, ?int $studentId = null): array
    {
        return $this->as($token ?? $this->token('t1@x.sa'))
            ->postJson('/api/students/'.($studentId ?? $this->s1->student_id).'/share-link')
            ->assertStatus(201)->json();
    }

    private function pathOf(array $link): string
    {
        return parse_url($link['url'], PHP_URL_PATH);
    }

    // ---- creation scope ----

    /** Only the student's own teacher (or the circle admin / Sys Admin) may create a link. */
    public function test_only_the_students_own_teacher_can_create_a_link(): void
    {
        $t1 = $this->token('t1@x.sa');
        $this->as($t1)->postJson("/api/students/{$this->s2->student_id}/share-link")->assertStatus(403); // t2's student
        $this->as($t1)->postJson("/api/students/{$this->s3->student_id}/share-link")->assertStatus(403); // other circle
        $this->as($this->token('a2@x.sa'))->postJson("/api/students/{$this->s1->student_id}/share-link")->assertStatus(403);
        $this->as($this->studentToken('AAAA1111'))->postJson("/api/students/{$this->s1->student_id}/share-link")->assertStatus(403);
        $this->asGuest()->postJson("/api/students/{$this->s1->student_id}/share-link")->assertStatus(401);
        $this->as($t1)->postJson("/api/students/{$this->s1->student_id}/share-link")->assertStatus(201);
    }

    /** §2.13 — 32 random bytes, base64url: 43 characters, never sequential, never derived from student_id. */
    public function test_token_is_43_characters_of_base64url_and_unpredictable(): void
    {
        $t = $this->token('t1@x.sa');
        $a = ProgressShareLink::find($this->issue($t)['link_id']);
        $b = ProgressShareLink::find($this->issue($t)['link_id']);
        foreach ([$a, $b] as $link) {
            $this->assertSame(43, strlen($link->token));
            $this->assertMatchesRegularExpression('/^[A-Za-z0-9_-]{43}$/', $link->token);
        }
        // Not sequential and not derived from student_id: two links for the same student differ.
        $this->assertNotSame($a->token, $b->token);
        $this->assertSame($a->student_id, $b->student_id);
    }

    public function test_creating_a_link_is_audited_and_defaults_to_thirty_days(): void
    {
        $link = $this->issue();
        $this->assertDatabaseHas('audit_log', ['entity' => 'progress_share_link', 'action' => 'CREATE', 'entity_id' => $link['link_id']]);
        $expires = \Illuminate\Support\Carbon::parse($link['expires_at']);
        $this->assertTrue($expires->gt(now()->addDays(29)) && $expires->lt(now()->addDays(31)), 'default expiry should be 30 days');
    }

    /**
     * §2.13 — the link records the teacher who created it, which is what makes "the teacher
     * who created it can revoke it" auditable after the fact.
     */
    public function test_a_link_records_the_teacher_who_created_it(): void
    {
        $link = \App\Models\ProgressShareLink::find($this->issue()['link_id']);

        $this->assertSame($this->t1->user_id, $link->created_by_user_id);
        $this->assertSame($this->t1->email, $link->createdBy()->first()->email);
        // The token is the only credential, so it must never be serialised out of the model.
        $this->assertArrayNotHasKey('token', $link->toArray());
    }

    // ---- the public card ----

    /** §2.13 — the card carries the minimum and nothing else. */
    public function test_card_exposes_only_the_permitted_fields(): void
    {
        $t = $this->token('t1@x.sa');
        $this->logSession($t, $this->s1->student_id, now()->toDateString(), 3, [1, 3])->assertStatus(201);
        $body = $this->get($this->pathOf($this->issue($t)))->assertOk()->getContent();

        $this->assertStringContainsString('S1', $body);                       // first name only…
        $this->assertStringNotContainsString('Alpha', $body);                  // …never the full name
        $this->assertStringNotContainsString($this->s1->access_code, $body);   // no access code
        $this->assertStringNotContainsString('MEM_GAP', $body);                // no error detail
        $this->assertStringNotContainsString('TAJ_ERR', $body);
        $this->assertStringNotContainsString('87.8', $body);                   // mastery BAND, not the raw score
        $this->assertStringNotContainsString('S2', $body);                     // no comparison with other students
        $this->assertStringNotContainsString('rank', strtolower($body));       // no leaderboard position
        $this->assertStringNotContainsString('C1', $body);                     // circle name is not on the card
    }

    /** §2.13 — the page must never be indexed: header and meta tag. */
    public function test_card_is_noindex_in_both_the_header_and_the_page(): void
    {
        $res = $this->get($this->pathOf($this->issue()))->assertOk();
        $this->assertStringContainsString('noindex', $res->headers->get('X-Robots-Tag'));
        $this->assertStringContainsString('<meta name="robots" content="noindex', $res->getContent());
    }

    public function test_card_renders_in_arabic_and_english(): void
    {
        $path = $this->pathOf($this->issue());
        $this->assertStringContainsString('dir="rtl"', $this->get($path.'?lang=ar')->assertOk()->getContent());
        $this->assertStringContainsString('dir="ltr"', $this->get($path.'?lang=en')->assertOk()->getContent());
    }

    /** §2.13 — every view writes an audit_log row (action VIEW) and bumps the counters. */
    public function test_every_view_is_audited_and_counted(): void
    {
        $link = $this->issue();
        $path = $this->pathOf($link);
        $this->get($path)->assertOk();
        $this->get($path)->assertOk();

        $this->assertDatabaseHas('audit_log', ['entity' => 'progress_share_link', 'action' => 'VIEW', 'entity_id' => $link['link_id'], 'actor_user_id' => null]);
        $this->assertSame(2, ProgressShareLink::find($link['link_id'])->view_count);
        $this->assertNotNull(ProgressShareLink::find($link['link_id'])->last_viewed_at);
    }

    // ---- 404 cases: never confirm that a link existed ----

    public function test_expired_token_returns_404(): void
    {
        $link = $this->issue();
        ProgressShareLink::where('link_id', $link['link_id'])->update(['expires_at' => now()->subMinute()]);
        $this->get($this->pathOf($link))->assertStatus(404);
    }

    public function test_revoked_token_returns_404(): void
    {
        $t = $this->token('t1@x.sa');
        $link = $this->issue($t);
        $this->as($t)->deleteJson("/api/share-links/{$link['link_id']}")->assertOk();
        $this->get($this->pathOf($link))->assertStatus(404);
        $this->assertDatabaseHas('audit_log', ['entity' => 'progress_share_link', 'action' => 'UPDATE', 'entity_id' => $link['link_id']]);
    }

    public function test_tampering_with_one_character_returns_404(): void
    {
        $link = $this->issue();
        $path = $this->pathOf($link);
        $last = substr($path, -1);
        $this->get(substr($path, 0, -1).($last === 'a' ? 'b' : 'a'))->assertStatus(404);
        $this->get('/p/'.str_repeat('a', 43))->assertStatus(404);   // well-formed but unknown
        $this->get('/p/short')->assertStatus(404);                   // malformed
    }

    // ---- revocation scope ----

    public function test_only_authorised_staff_can_revoke(): void
    {
        $link = $this->issue();
        $this->asGuest()->deleteJson("/api/share-links/{$link['link_id']}")->assertStatus(401);
        $this->as($this->studentToken('AAAA1111'))->deleteJson("/api/share-links/{$link['link_id']}")->assertStatus(403);
        $this->as($this->token('t2@x.sa'))->deleteJson("/api/share-links/{$link['link_id']}")->assertStatus(403);
        $this->as($this->token('a2@x.sa'))->deleteJson("/api/share-links/{$link['link_id']}")->assertStatus(403);
        $this->as($this->token('t1@x.sa'))->deleteJson("/api/share-links/{$link['link_id']}")->assertOk();
        $this->as($this->token('t1@x.sa'))->deleteJson('/api/share-links/999999')->assertStatus(404);
    }

    /** Issuing a new link retires the previous one, so an old URL stops working. */
    public function test_issuing_a_new_link_revokes_the_previous_one(): void
    {
        $t = $this->token('t1@x.sa');
        $first = $this->issue($t);
        $second = $this->issue($t);
        $this->get($this->pathOf($first))->assertStatus(404);
        $this->get($this->pathOf($second))->assertOk();
    }
}
