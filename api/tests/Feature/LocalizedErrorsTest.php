<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * NFR6 — a refusal reaches an Arabic screen in Arabic. The clients send Accept-Language with
 * the interface locale; without it the API keeps answering in English.
 */
class LocalizedErrorsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWorld();
    }

    public function test_a_failed_sign_in_is_answered_in_the_requested_language(): void
    {
        $this->withHeader('Accept-Language', 'ar')->postJson('/api/auth/login', ['email' => 'sys@x.sa', 'password' => 'wrong'])
            ->assertStatus(401)->assertJsonPath('message', 'بيانات الدخول غير صحيحة');

        $this->flushHeaders()->postJson('/api/auth/login', ['email' => 'sys@x.sa', 'password' => 'wrong'])
            ->assertStatus(401)->assertJsonPath('message', 'Invalid credentials');
    }

    public function test_validation_errors_name_the_field_in_arabic(): void
    {
        $res = $this->withHeader('Accept-Language', 'ar')->postJson('/api/auth/login', ['password' => 'x'])->assertStatus(422);
        $this->assertSame('حقل البريد الإلكتروني مطلوب.', $res->json('errors.email.0'));
    }

    public function test_an_rbac_refusal_does_not_show_the_role_code(): void
    {
        $res = $this->as($this->token('t1@x.sa'))->withHeader('Accept-Language', 'ar')->getJson('/api/settings')->assertForbidden();
        $this->assertSame('ليس لديك صلاحية لهذا الإجراء', $res->json('message'));

        $this->as($this->studentToken('AAAA1111'))->withHeader('Accept-Language', 'ar')
            ->getJson("/api/students/{$this->s2->student_id}")->assertForbidden()
            ->assertJsonPath('message', 'يمكن للطالب الاطلاع على بياناته فقط');
    }

    public function test_a_staff_management_refusal_is_answered_in_arabic(): void
    {
        $this->as($this->token('a1@x.sa'))->withHeader('Accept-Language', 'ar')
            ->patchJson("/api/staff/{$this->sys->user_id}", ['is_active' => false])->assertForbidden()
            ->assertJsonPath('message', 'لا يمكن تعديل حسابات مديري النظام من هنا');
    }

    public function test_a_failure_inside_the_ml_service_is_not_shown_to_the_user(): void
    {
        $this->fakeHttp(['*' => Http::response(['detail' => 'ML_DATABASE_URL not set'], 503)]);

        $res = $this->as($this->token('sys@x.sa'))->getJson('/api/forecast-evaluation')->assertStatus(502);
        $this->assertStringNotContainsString('ML_DATABASE_URL', $res->json('message'));
    }

    public function test_the_evaluation_refusal_is_translated_for_an_arabic_screen(): void
    {
        $this->fakeHttp(['*' => Http::response(['detail' => 'Dataset too small for a meaningful held-out evaluation'], 422)]);

        $this->as($this->token('sys@x.sa'))->withHeader('Accept-Language', 'ar')->getJson('/api/forecast-evaluation')
            ->assertStatus(422)->assertJsonPath('message', 'لا توجد بعدُ بيانات مسجّلة كافية لتقييم موثوق.');
    }
}
