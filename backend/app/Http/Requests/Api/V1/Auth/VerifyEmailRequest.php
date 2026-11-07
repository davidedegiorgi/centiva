<?php

namespace App\Http\Requests\Api\V1\Auth;

use Illuminate\Foundation\Http\FormRequest;

class VerifyEmailRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email', 'max:254'],
            'code' => ['required', 'digits:6'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.required' => "L'indirizzo email è obbligatorio.",
            'email.email' => "L'indirizzo email non è valido.",
            'code.required' => 'Inserisci il codice ricevuto via email.',
            'code.digits' => 'Il codice deve contenere esattamente 6 cifre.',
        ];
    }
}
