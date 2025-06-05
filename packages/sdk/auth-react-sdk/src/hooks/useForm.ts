import { useState, useCallback } from 'react';

/**
 * Hook for managing form state with validation
 */
export const useForm = <T extends Record<string, any>>(
    initialValues: T,
    validator?: (values: T) => Record<string, string>
) => {
    const [values, setValues] = useState<T>(initialValues);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});

    const setValue = useCallback((field: keyof T, value: any) => {
        setValues(prev => ({ ...prev, [field]: value }));
        
        // Clear field error when value changes
        if (errors[field as string]) {
            setErrors(prev => ({ ...prev, [field as string]: undefined }));
        }
    }, [errors]);

    const setFieldTouched = useCallback((field: keyof T, touched = true) => {
        setTouched(prev => ({ ...prev, [field as string]: touched }));
    }, []);

    const validate = useCallback(() => {
        if (!validator) return true;
        
        const validationErrors = validator(values);
        setErrors(validationErrors);
        return Object.keys(validationErrors).length === 0;
    }, [validator, values]);

    const reset = useCallback(() => {
        setValues(initialValues);
        setErrors({});
        setTouched({});
    }, [initialValues]);

    const getFieldProps = useCallback((field: keyof T) => ({
        value: values[field],
        onChange: (value: any) => setValue(field, value),
        onBlur: () => setFieldTouched(field),
        error: touched[field as string] ? errors[field as string] : undefined
    }), [values, errors, touched, setValue, setFieldTouched]);

    return {
        values,
        errors,
        touched,
        setValue,
        setFieldTouched,
        validate,
        reset,
        getFieldProps,
        isValid: Object.keys(errors).length === 0,
        isDirty: JSON.stringify(values) !== JSON.stringify(initialValues)
    };
};
