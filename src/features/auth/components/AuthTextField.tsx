import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'
import { Text, TextInput, View, type TextInputProps } from 'react-native'

interface AuthTextFieldProps<T extends FieldValues> extends Pick<TextInputProps, 'placeholder' | 'secureTextEntry' | 'keyboardType' | 'autoComplete' | 'textContentType'> {
    control: Control<T>
    name: Path<T>
}

export function AuthTextField<T extends FieldValues>({ control, name, ...inputProps }: AuthTextFieldProps<T>) {
    return (
        <Controller
            control={control}
            name={name}
            render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                <View className="gap-1.5">
                    <TextInput
                        className="h-14 rounded-2xl bg-surface px-4 text-[16px] text-content-primary"
                        placeholderTextColor="#EBEBF54D"
                        autoCapitalize="none"
                        autoCorrect={false}
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        {...inputProps}
                    />
                    {error ? <Text className="px-1 text-[13px] text-danger">{error.message}</Text> : null}
                </View>
            )}
        />
    )
}
