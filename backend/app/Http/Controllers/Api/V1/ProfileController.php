<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\DeleteProfileRequest;
use App\Http\Requests\Api\V1\UpdateProfileRequest;
use App\Http\Resources\Api\V1\UserResource;
use App\Services\AccountEmailService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class ProfileController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return (new UserResource($request->user()))->response();
    }

    public function update(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->update($request->safe()->only(['name', 'email']));

        return (new UserResource($user->refresh()))->response();
    }

    public function destroy(
        DeleteProfileRequest $request,
        AccountEmailService $accountEmailService,
    ): Response {
        $user = $request->user();
        $userId = $user->getAuthIdentifier();
        $email = $user->email;
        $name = $user->name;

        // Logout first: the session guard rotates and persists the remember
        // token during logout, which would otherwise recreate stale state
        // after the user row has already been deleted.
        Auth::guard('web')->logout();
        Auth::guard('sanctum')->forgetUser();

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        DB::transaction(function () use ($email, $user, $userId): void {
            DB::table('password_reset_tokens')->where('email', $email)->delete();

            if (config('session.driver') === 'database') {
                DB::table((string) config('session.table', 'sessions'))
                    ->where('user_id', $userId)
                    ->delete();
            }

            $deletedRows = DB::table('users')->where('id', $userId)->delete();

            if ($deletedRows !== 1 || DB::table('users')->where('id', $userId)->exists()) {
                throw new \RuntimeException('Eliminazione account non completata.');
            }
        });

        $accountEmailService->sendDeletionConfirmationAfterResponse($email, $name);

        return response()->noContent();
    }
}
