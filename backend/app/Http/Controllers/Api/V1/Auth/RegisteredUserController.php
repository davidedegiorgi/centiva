<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Auth\RegisterRequest;
use App\Http\Resources\Api\V1\UserResource;
use App\Models\User;
use App\Services\AccountEmailService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class RegisteredUserController extends Controller
{
    public function __invoke(
        RegisterRequest $request,
        AccountEmailService $accountEmailService,
    ): JsonResponse {
        $user = User::query()->create($request->safe()->only([
            'name',
            'email',
            'password',
        ]));

        Auth::login($user, true);
        $request->session()->regenerate();
        $accountEmailService->sendWelcome($user);

        return (new UserResource($user))
            ->response()
            ->setStatusCode(201);
    }
}
