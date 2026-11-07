<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Auth\ResendVerificationCodeRequest;
use App\Http\Requests\Api\V1\Auth\VerifyEmailRequest;
use App\Http\Resources\Api\V1\UserResource;
use App\Models\User;
use App\Services\AccountEmailService;
use App\Services\EmailVerificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class EmailVerificationController extends Controller
{
    public function store(
        VerifyEmailRequest $request,
        EmailVerificationService $verificationService,
        AccountEmailService $accountEmailService,
    ): JsonResponse {
        $user = User::query()->where('email', $request->string('email')->toString())->first();

        if ($user === null) {
            throw ValidationException::withMessages(['code' => 'Il codice inserito non è corretto.']);
        }

        if ($user->email_verified_at !== null) {
            throw ValidationException::withMessages([
                'email' => 'Questo indirizzo email è già verificato. Puoi accedere normalmente.',
            ]);
        }

        $verificationService->verify($user, $request->string('code')->toString());

        Auth::login($user, true);
        $request->session()->regenerate();
        $accountEmailService->sendWelcomeAfterResponse($user);

        return (new UserResource($user->refresh()))->response();
    }

    public function resend(
        ResendVerificationCodeRequest $request,
        EmailVerificationService $verificationService,
    ): JsonResponse {
        $user = User::query()
            ->where('email', $request->string('email')->toString())
            ->whereNull('email_verified_at')
            ->first();

        if ($user !== null) {
            $verificationService->issue($user);
        }

        return response()->json([
            'message' => 'Se l’account è in attesa di verifica, abbiamo inviato un nuovo codice.',
        ]);
    }
}
