<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Auth\RegisterRequest;
use App\Models\User;
use App\Services\EmailVerificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class RegisteredUserController extends Controller
{
    public function __invoke(
        RegisterRequest $request,
        EmailVerificationService $verificationService,
    ): JsonResponse {
        $user = DB::transaction(function () use ($request, $verificationService): User {
            $user = User::query()->create($request->safe()->only([
                'name',
                'email',
                'password',
            ]));

            $verificationService->issue($user);

            return $user;
        });

        return response()->json([
            'message' => 'Ti abbiamo inviato un codice di verifica a 6 cifre.',
            'email' => $user->email,
            'verification_required' => true,
        ], 201);
    }
}
