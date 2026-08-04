import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MailCheck } from 'lucide-react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterFormValues } from '@/features/auth/schemas';
import { signUp } from '@/features/auth/api';
import { AuthTextField } from '@/features/auth/components/AuthTextField';

export default function RegisterScreen() {
  const [isEmailConfirmationPending, setIsEmailConfirmationPending] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  async function onSubmit(values: RegisterFormValues) {
    const { data, error } = await signUp(values.email, values.password);
    if (error) {
      setError('root', { message: error.message === 'User already registered' ? 'Un compte existe déjà avec cet email' : 'Impossible de créer le compte' });
      return;
    }
    if (!data.session) setIsEmailConfirmationPending(true);
  }

  if (isEmailConfirmationPending) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-accent">
            <MailCheck size={28} color="#FFFFFF" />
          </View>
          <Text className="text-center text-[20px] font-bold text-content-primary">Vérifie tes emails</Text>
          <Text className="text-center text-[15px] text-content-secondary">
            On t’a envoyé un lien de confirmation. Clique dessus pour activer ton compte, puis reviens te connecter.
          </Text>
          <Link href="/(auth)/login" asChild>
            <Text className="text-center text-[14px] font-medium text-accent-light">Retour à la connexion</Text>
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <KeyboardAwareScrollView
        contentContainerClassName="flex-1 justify-center gap-6 px-6"
        keyboardShouldPersistTaps="handled"
        bottomOffset={20}
      >
        <View className="items-center gap-3">
          <Image
            source={require('../../../assets/icon.png')}
            style={{ width: 140, height: 140 }}
            contentFit="contain"
          />
          <Text className="text-[28px] font-bold text-content-primary">Créer un compte</Text>
          <Text className="text-center text-[15px] text-content-secondary">
            Rejoins votre bibliothèque de films et séries partagée.
          </Text>
        </View>

        <View className="gap-3">
          <AuthTextField
            control={control}
            name="email"
            placeholder="Email"
            keyboardType="email-address"
            autoComplete="email"
          />
          <AuthTextField
            control={control}
            name="password"
            placeholder="Mot de passe"
            secureTextEntry
            autoComplete="password-new"
          />
          <AuthTextField
            control={control}
            name="confirmPassword"
            placeholder="Confirmer le mot de passe"
            secureTextEntry
            autoComplete="password-new"
          />

          {errors.root ? (
            <Text className="text-center text-[13px] text-danger">{errors.root.message}</Text>
          ) : null}

          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="h-14 items-center justify-center rounded-2xl bg-accent active:opacity-70 disabled:opacity-50"
          >
            <Text className="text-[16px] font-semibold text-content-primary">
              {isSubmitting ? 'Création...' : 'Créer mon compte'}
            </Text>
          </Pressable>
          <Link href="/(auth)/login" asChild>
            <Text className="text-center text-[14px] font-medium text-accent-light">
              Déjà un compte ? Connectes toi
            </Text>
          </Link>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
