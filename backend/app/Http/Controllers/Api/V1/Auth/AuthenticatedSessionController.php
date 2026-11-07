<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Auth\LoginRequest;
use App\Http\Resources\Api\V1\UserResource;
use App\Services\AccountEmailService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Throwable;

class AuthenticatedSessionController extends Controller
{
    public function store(LoginRequest $request, AccountEmailService $accountEmailService): JsonResponse
    {
        $credentials = $request->safe()->only(['email', 'password']);

        if (! Auth::attempt($credentials, true)) {
            throw ValidationException::withMessages([
                'email' => 'Le credenziali non sono corrette.',
            ]);
        }

        if ($request->user()?->email_verified_at === null) {
            Auth::guard('web')->logout();

            return response()->json([
                'message' => 'Verifica il tuo indirizzo email prima di accedere.',
                'code' => 'email_verification_required',
                'email' => $request->string('email')->toString(),
            ], 403);
        }

        $request->session()->regenerate();

        try {
            $accountEmailService->sendWelcome($request->user());
        } catch (Throwable $exception) {
            // L'accesso resta disponibile e il benvenuto verrà ritentato
            // al prossimo login finché Brevo non lo accetta.
            report($exception);
        }

        return (new UserResource($request->user()))->response();
    }

    public function destroy(Request $request): Response
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }
}
