<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Auth\RegisterRequest;
use App\Models\User;
use App\Services\EmailVerificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

class RegisteredUserController extends Controller
{
    public function __invoke(
        RegisterRequest $request,
        EmailVerificationService $verificationService,
    ): JsonResponse {
        $user = null;
        $email = $request->string('email')->toString();

        if (User::query()->where('email', $email)->whereNotNull('email_verified_at')->exists()) {
            throw ValidationException::withMessages([
                'email' => 'Esiste già un account con questo indirizzo email.',
            ]);
        }

        try {
            // Never keep a database transaction open while waiting for an
            // external mail server. Persist first, then deliver the code.
            $user = DB::transaction(function () use ($request, $email): User {
                $user = User::query()->where('email', $email)->lockForUpdate()->first();
                $attributes = $request->safe()->only(['name', 'email', 'password']);

                if ($user === null) {
                    return User::query()->create($attributes);
                }

                $user->update($attributes);

                return $user;
            });

            $verificationService->issue($user);
        } catch (Throwable $exception) {
            report($exception);

            // A user without a deliverable verification code must not remain
            // in the database and block a subsequent registration attempt.
            if ($user instanceof User && $user->exists) {
                $user->delete();
            }

            return response()->json([
                'message' => 'Non siamo riusciti a inviare il codice. Riprova tra poco.',
                'code' => 'verification_email_delivery_failed',
            ], 503);
        }

        return response()->json([
            'message' => 'Ti abbiamo inviato un codice di verifica a 6 cifre.',
            'email' => $user->email,
            'verification_required' => true,
        ], 201);
    }
}
