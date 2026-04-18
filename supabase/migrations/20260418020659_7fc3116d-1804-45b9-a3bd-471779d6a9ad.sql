
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.generate_slug(input_text TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE result TEXT;
BEGIN
  result := lower(input_text);
  result := translate(result, 'áàâãäåçéèêëíìîïñóòôõöúùûüý', 'aaaaaaceeeeiiiinooooouuuuy');
  result := regexp_replace(result, '[^a-z0-9]+', '-', 'g');
  result := regexp_replace(result, '^-+|-+$', '', 'g');
  IF result = '' THEN result := 'empresa'; END IF;
  RETURN result;
END;
$$;

CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT, username TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count INT; assigned_role public.app_role;
BEGIN
  INSERT INTO public.profiles (user_id, email, username)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN assigned_role := 'admin'; ELSE assigned_role := 'user'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cnpj TEXT NOT NULL, razao_social TEXT NOT NULL, nome_fantasia TEXT NOT NULL,
  uf TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.set_company_slug()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE base_slug TEXT; candidate TEXT; counter INT := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := public.generate_slug(NEW.nome_fantasia);
    candidate := base_slug;
    WHILE EXISTS (SELECT 1 FROM public.companies WHERE slug = candidate) LOOP
      counter := counter + 1;
      candidate := base_slug || '-' || counter;
    END LOOP;
    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER set_company_slug_trigger BEFORE INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_company_slug();

CREATE TABLE public.user_companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id)
);
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_has_company_access(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_companies WHERE user_id = _user_id AND company_id = _company_id)
    OR public.has_role(_user_id, 'admin')
$$;

CREATE POLICY "View own company links" ON public.user_companies
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage company links" ON public.user_companies
  FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Companies: members can view via membership; admins manage; PUBLIC can also view (for /p/:slug shared page)
CREATE POLICY "Public read companies" ON public.companies FOR SELECT USING (true);
CREATE POLICY "Admins insert companies" ON public.companies FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update companies" ON public.companies FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete companies" ON public.companies FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.link_creator_to_company()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.user_companies (user_id, company_id) VALUES (NEW.created_by, NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER link_creator_to_company_trigger AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.link_creator_to_company();

CREATE TABLE public.fiscal_movement (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  competencia TEXT NOT NULL,
  entrada NUMERIC NOT NULL DEFAULT 0,
  saida NUMERIC NOT NULL DEFAULT 0,
  icms NUMERIC NOT NULL DEFAULT 0,
  impostos_federais NUMERIC NOT NULL DEFAULT 0,
  simples_nacional NUMERIC NOT NULL DEFAULT 0,
  honorarios NUMERIC NOT NULL DEFAULT 0,
  folha NUMERIC NOT NULL DEFAULT 0,
  encargos_patronal NUMERIC NOT NULL DEFAULT 0,
  difal NUMERIC NOT NULL DEFAULT 0,
  pis NUMERIC NOT NULL DEFAULT 0,
  cofins NUMERIC NOT NULL DEFAULT 0,
  irpj NUMERIC NOT NULL DEFAULT 0,
  csll NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, competencia)
);
ALTER TABLE public.fiscal_movement ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_fiscal_movement_company ON public.fiscal_movement(company_id, competencia);
CREATE TRIGGER update_fiscal_movement_updated_at BEFORE UPDATE ON public.fiscal_movement
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Public read fiscal" ON public.fiscal_movement FOR SELECT USING (true);
CREATE POLICY "Members insert fiscal" ON public.fiscal_movement FOR INSERT WITH CHECK (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Members update fiscal" ON public.fiscal_movement FOR UPDATE USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Members delete fiscal" ON public.fiscal_movement FOR DELETE USING (public.user_has_company_access(auth.uid(), company_id));

CREATE TABLE public.fiscal_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  show_icms_column BOOLEAN NOT NULL DEFAULT true,
  show_impostos_federais_column BOOLEAN NOT NULL DEFAULT true,
  show_simples_nacional_column BOOLEAN NOT NULL DEFAULT true,
  show_honorarios_column BOOLEAN NOT NULL DEFAULT true,
  show_folha_column BOOLEAN NOT NULL DEFAULT true,
  show_encargos_patronal_column BOOLEAN NOT NULL DEFAULT true,
  show_difal_column BOOLEAN NOT NULL DEFAULT true,
  show_pis_column BOOLEAN NOT NULL DEFAULT true,
  show_cofins_column BOOLEAN NOT NULL DEFAULT true,
  show_irpj_column BOOLEAN NOT NULL DEFAULT true,
  show_csll_column BOOLEAN NOT NULL DEFAULT true,
  label_competencia TEXT NOT NULL DEFAULT 'Competência',
  label_entrada TEXT NOT NULL DEFAULT 'Entrada',
  label_saida TEXT NOT NULL DEFAULT 'Saída',
  label_icms TEXT NOT NULL DEFAULT 'ICMS',
  label_impostos_federais TEXT NOT NULL DEFAULT 'Impostos Federais',
  label_simples_nacional TEXT NOT NULL DEFAULT 'Simples Nacional',
  label_honorarios TEXT NOT NULL DEFAULT 'Honorários',
  label_folha TEXT NOT NULL DEFAULT 'Folha',
  label_encargos_patronal TEXT NOT NULL DEFAULT 'Encargos Patronal',
  label_difal TEXT NOT NULL DEFAULT 'DIFAL',
  label_pis TEXT NOT NULL DEFAULT 'PIS',
  label_cofins TEXT NOT NULL DEFAULT 'COFINS',
  label_irpj TEXT NOT NULL DEFAULT 'IRPJ',
  label_csll TEXT NOT NULL DEFAULT 'CSLL',
  aliquota_simples_nacional NUMERIC NOT NULL DEFAULT 6.0,
  auto_calculate_simples_nacional BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fiscal_config ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_fiscal_config_updated_at BEFORE UPDATE ON public.fiscal_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Public read fiscal_config" ON public.fiscal_config FOR SELECT USING (true);
CREATE POLICY "Members insert fiscal_config" ON public.fiscal_config FOR INSERT WITH CHECK (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Members update fiscal_config" ON public.fiscal_config FOR UPDATE USING (public.user_has_company_access(auth.uid(), company_id));

CREATE OR REPLACE FUNCTION public.create_default_fiscal_config()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.fiscal_config (company_id) VALUES (NEW.id) ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER create_fiscal_config_trigger AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.create_default_fiscal_config();
