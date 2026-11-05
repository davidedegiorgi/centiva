<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DeleteProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'confirmation' => ['required', 'string', Rule::in(['ELIMINA'])],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'confirmation.required' => 'Scrivi ELIMINA per confermare la cancellazione.',
            'confirmation.in' => 'La parola di conferma deve essere ELIMINA.',
        ];
    }
}
