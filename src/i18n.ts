import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  'pt-BR': {
    translation: {
      login: {
        subtitle: "Gestão de Coletivas",
        emailLabel: "Usuário / E-mail",
        emailPlaceholder: "seu@email.com",
        passwordLabel: "Senha",
        passwordPlaceholder: "••••••••",
        button: "ENTRAR NO SISTEMA",
        loading: "Acessando...",
        forgotPassword: "Esqueceu sua senha?",
        support: "Contate o suporte",
        version: "v2.5.0 • Pratique Fitness"
      },
      errors: {
        invalidCredential: "E-mail ou senha incorretos.",
        userNotFound: "Usuário não encontrado.",
        wrongPassword: "Senha incorreta.",
        tooManyRequests: "Muitas tentativas. Tente novamente mais tarde.",
        userDisabled: "Conta desativada. Fale com o suporte.",
        default: "Erro ao acessar. Tente novamente."
      },
      layout: {
        menu: "Menu",
        title: "Gestão Pratique",
        loading: "Carregando..."
      },
      menu: {
        dashboard: "Central de Resultados",
        finance: "Financeiro & Tesouraria",
        import: "Motor de Ingestão",
        settings: "Gestão Corporativa",
        logout: "Sair"
      },
      dashboard: {
        title: "Central de Resultados",
        billing: "Faturamento",
        enrollments: "Matrículas",
        activeConsultants: "Consultores Ativos",
        unitsWithSales: "Unidades com Venda"
      },
      sidebar: {
        brandSubtitle: "Gestão de Coletivas",
        sections: {
          principal: "Principal",
          operacional: "Operacional",
          gestao: "Gestão"
        },
        items: {
          inicio: "Início",
          cronograma: "Cronograma",
          linkAluno: "Link do Aluno",
          validacaoDiaria: "Validação Diária",
          validacaoColetiva: "Validação Coletiva",
          performanceFinanceira: "Performance Financeira",
          relatorios: "Relatórios",
          configuracoes: "Configurações"
        }
      },
      home: {
        greeting: {
          morning: "Bom dia",
          afternoon: "Boa tarde",
          night: "Boa noite"
        },
        roles: {
          admin: "Administrador",
          professor: "Professor",
          mentor: "Mentor",
          unidade: "Unidade"
        },
        systemOnline: "Sistema Online",
        cardDefaults: {
          access: "Acessar"
        },
        cards: {
          reports: {
            title: "Relatório Gerencial",
            subtitle: "Performance Financeira",
            revenueYesterday: "RECEITA DE ONTEM",
            monthlyForecast: "PREVISÃO MENSAL",
            footer: "Ver Detalhes",
            monthlyEstimate: "Previsão Mensal (Est.)"
          },
          schedule: {
            title: "Cronograma",
            subtitle: "Grade de aulas",
            footer: "Ver Grade Completa",
            next: "Próxima",
            unit: "Unidade",
            teacher: "Professor",
            noMoreClasses: "Sem mais aulas hoje",
            defaultModality: "Coletiva",
            defaultTeacher: "Instrutor"
          },
          validation: {
            title: "Validação Diária",
            subtitle: "CONTROLE DE PRESENÇA",
            resolveNow: "Resolver Agora",
            history: "Histórico",
            classes: "Aulas",
            pending: "Pendentes",
            allValidated: "Tudo Validado!"
          },
          monitoring: {
            title: "Monitoramento de Validação",
            subtitle: "Status de Ontem",
            footer: "Ver Ranking",
            status: {
              goalMet: "Meta Batida",
              highAdhesion: "Alta Adesão",
              attention: "ATENÇÃO",
              critical: "Crítico",
              excellent: "EXCELENTE",
              inProgress: "EM ANDAMENTO"
            },
            validatedOf: "{{validated}} de {{total}} validadas"
          },
          pratiquePlay: {
            title: "PRATIQUE PLAY",
            subtitle: "MÚSICAS PARA AULAS",
            footer: "Acessar Play",
            insideLine1: "PLAYLISTS DAS",
            insideLine2: "COLETIVAS"
          },
          linkAluno: {
            title: "LINK DO ALUNO",
            subtitle: "ACESSO EXTERNO",
            footer: "Abrir Portal",
            insideLine1: "PORTAL DE",
            insideLine2: "ALUNOS"
          },
          settings: {
            title: "Configurações",
            subtitle: "Painel Administrativo",
            footer: "Gerenciar",
            units: "Unidades",
            mods: "Mods",
            profs: "Profs"
          }
        }
      },
      publicSchedule: {
        title: "Quadro de Horários",
        location: "Localização",
        clearFilter: "Limpar Filtro",
        all: "Todas",
        searchPlaceholder: "Buscar unidade ou modalidade...",
        searchIn: "Buscar em {{state}}...",
        classesFound: "Aulas Encontradas",
        viewGrid: "VER GRADE",
        unitsAvailable: "Unidades Disponíveis",
        noUnitsFound: "Nenhuma unidade encontrada.",
        tryChangeFilter: "Tente mudar o termo ou limpar o filtro.",
        developedBy: "Desenvolvido por Pratique Fitness",
        back: "Voltar",
        printAdjustment: "Ajuste de Impressão",
        printAuto: "Automático",
        printAutoDesc: "O sistema decide",
        printCompact: "Compactar",
        printCompactDesc: "Para grades grandes",
        printExpand: "Expandir",
        printExpandDesc: "Para grades pequenas",
        emptyGrid: "Grade vazia.",
        defaultTeacher: "Instrutor",
        days: {
          Segunda: "Segunda",
          Terça: "Terça",
          Quarta: "Quarta",
          Quinta: "Quinta",
          Sexta: "Sexta",
          Sábado: "Sábado",
          Domingo: "Domingo"
        }
      },
      schedulePage: {
        title: "Agenda de Coletivas",
        subtitle: "Gerenciamento de Grade e Horário",
        subtitleReadOnly: "Consulte os horários de todas as unidades",
        closedBadge: "Encerrada",
        closedClassTitle: "Aula Encerrada (Apenas Histórico)",
        activeClassTitle: "Aula Ativa",
        filters: {
          state: "Estado",
          allStates: "Todos os Estados",
          unit: "Unidade",
          allUnits: "Selecione...",
          searchInGrid: "Filtrar nesta grade",
          searchEverywhere: "Buscar Modalidade em todas as unidades",
          searchPlaceholderInGrid: "Ex: Spinning...",
          searchPlaceholderEverywhere: "Ex: Digite 'Pilates' para ver onde tem..."
        },
        buttons: {
          showHistory: "Ver Encerradas",
          hideHistory: "Ocultar Encerradas",
          add: "Adicionar"
        },
        placeholders: {
          startSearchTitle: "Comece sua busca",
          startSearchDesc: "Selecione uma Unidade para ver o calendário ou digite uma Modalidade para buscar em todas.",
          resultsFor: "Resultados para",
          noClassesFound: "Nenhuma aula encontrada com este nome.",
          emptyGrid: "A grade atual está vazia. Tente clicar em 'Ver Encerradas'.",
          noClassesInUnit: "Nenhuma aula cadastrada nesta unidade.",
          createFirstClass: "Criar primeira aula"
        },
        modal: {
          newTitle: "CRIAR NOVA AULA",
          editTitle: "EDITAR AULA",
          modality: "Modalidade",
          teacher: "Professor Titular",
          time: "Horário",
          value: "Valor Hora/Aula",
          daysOfWeek: "Dias da Semana",
          startDate: "Aula Registrada a partir de",
          endDate: "Encerrar Permanentemente em",
          cancel: "Cancelar",
          save: "Salvar",
          delete: "Excluir",
          saveEdit: "Salvar Alterações",
          selectUnitAlert: "Selecione a unidade",
          noTeacherLinked: "Nenhum vinculado"
        },
        splitModal: {
          title: "Alteração de Grade",
          desc: "Você alterou dados importantes da aula. Como deseja que o sistema aplique essas mudanças no banco de dados?",
          recommendedBadge: "RECOMENDADO (Preserva o Passado)",
          newPhaseTitle: "Criar Nova Fase",
          newPhaseDesc: "Encerra a aula antiga de forma invisível e cria a nova. Nenhum relatório ou presença passada será perdida. Ideal para troca de horários, dias ou professores.",
          startDateLabel: "A NOVA CONFIGURAÇÃO PASSA A VALER NO DIA:",
          applyChange: "Aplicar Troca",
          or: "OU",
          directFixTitle: "Corrigir Erro de Digitação",
          directFixDesc: "Substitui os dados diretamente. Atenção: Isso altera o nome do professor e horários no passado. Use apenas se a aula foi cadastrada errada agora mesmo.",
          justReplace: "Apenas Substituir Dados",
          backToForm: "Voltar para o formulário",
          selectDateAlert: "Selecione a data exata em que a nova configuração começa a valer."
        },
        alerts: {
          fillRequired: "❌ Preencha todos os campos obrigatórios.",
          invalidDates: "❌ A data de encerramento não pode ser anterior à data de início.",
          deleteConfirm: "🗑️ LIXEIRA INTELIGENTE:\n\nDeseja ocultar esta aula da grade? Ela será removida da visualização de todos, mas o histórico e o banco de dados serão preservados (Soft Delete).",
          deleteError: "Erro ao enviar a aula para a lixeira.",
          saveError: "Erro ao salvar."
        }
      },
      reports: {
        title: "Inteligência Financeira",
        subtitle: "Painel Executivo de Folha e Ocupação",
        filters: {
          day: "DIA",
          month: "MÊS",
          period: "PERÍODO",
          export: "Exportar",
          advanced: "Filtros Avançados (Múltipla Escolha)",
          clear: "Limpar Filtros",
          country: "País",
          state: "Estado",
          mentor: "Mentor",
          unit: "Unidade",
          modality: "Modalidade",
          teacher: "Professor",
          shift: "Turno"
        },
        kpis: {
          vaultActivated: "Cofre de Relatórios Ativado",
          vaultDesc: "Para manter a velocidade do sistema, selecione pelo menos um Filtro Avançado para destrancar a inteligência financeira.",
          payrollSummary: "Resumo de Folha",
          totalToPay: "Total a Pagar no Período Filtrado",
          operationalEngine: "Motor Operacional",
          completedClasses: "Aulas Realizadas",
          canceledClasses: "Aulas Canceladas",
          avgClassValue: "Valor Médio P/ Aula",
          gridHealth: "Saúde da Grade",
          occupancyRate: "Taxa de Ocupação",
          vacancyRate: "Taxa de Vacância",
          avgStudents: "Média de Alunos"
        },
        table: {
          summary: "Resumo da Folha",
          detailed: "Detalhado",
          unit: "UNIDADE (PAÍS/ESTADO)",
          modality: "MODALIDADE",
          time: "HORÁRIO",
          teacher: "PROFESSOR",
          completed: "REALIZADAS",
          canceled: "CANCELADAS",
          avgStudentsCol: "MÉDIA ALUNOS",
          occupancyCol: "TAXA OCUPAÇÃO",
          classValue: "VALOR AULA",
          toReceive: "A RECEBER",
          noData: "SEM DADOS ENCONTRADOS PARA O FILTRO ATUAL."
        },
        buttons: {
          load20: "CARREGAR +20",
          load50: "CARREGAR +50",
          loadAll: "VER TODOS"
        }
      },
      settingsPage: {
        loadingModule: "Carregando módulo...",
        restrictedAccess: {
          title: "Acesso Restrito",
          desc: "Esta área é exclusiva para gestão."
        },
        title: "Painel de Configurações",
        subtitle: {
          unidade: "Gerencie o quadro de professores da sua unidade.",
          default: "Gerencie os registros globais e parâmetros do sistema."
        },
        tabs: {
          unidades: "Unidades",
          mentores: "Mentores",
          professores: "Professores",
          modalidades: "Modalidades",
          feriados: "Feriados",
          pratiquePlay: "Pratique Play",
          backup: "Backup"
        }
      },
      unitsTab: {
        title: "Gestão de Unidades",
        subtitle: "{{count}} unidades cadastradas",
        searchPlaceholder: "Buscar unidade, estado...",
        newUnit: "+ Nova Unidade",
        table: {
          status: "Status",
          unit: "Unidade",
          location: "Local",
          phone: "Telefone",
          responsible: "Responsável",
          actions: "Ações",
          active: "ATIVA",
          inactive: "INATIVA",
          notInformed: "Não informado",
          you: "Você",
          edit: "Editar",
          delete: "Excluir"
        },
        emptyState: "Nenhuma unidade encontrada.",
        modal: {
          editTitle: "Editar Unidade",
          newTitle: "Nova Unidade",
          location: "Localização",
          country: "País",
          state: "Estado",
          select: "Selecione...",
          unitName: "Nome da Unidade",
          unitNamePlaceholder: "Ex: Barreiro",
          phone: "Telefone WhatsApp",
          phonePlaceholder: "DDD + Número",
          mentor: "Mentor",
          status: "Status",
          statusActive: "Ativa",
          statusInactive: "Inativa",
          access: "Acesso Automático",
          generatedCreds: "Credenciais geradas:",
          login: "Login",
          loginWaiting: "Aguardando nome...",
          password: "Senha Padrão",
          accessWarning: "* O login é criado automaticamente. A senha pode ser alterada depois.",
          cancel: "Cancelar",
          saveEdit: "Salvar Alterações",
          saveNew: "Criar Unidade",
          saving: "Salvando..."
        },
        messages: {
          nameRequired: "Nome da unidade é obrigatório.",
          stateRequired: "Selecione um estado.",
          mentorRequired: "Mentor é obrigatório.",
          invalidEmail: "E-mail inválido.",
          weakPassword: "Senha mín. 6 dígitos.",
          updated: "Unidade atualizada!",
          created: "Unidade e Acesso criados!",
          emailExists: "E-mail já existe.",
          permissionDenied: "Erro de permissão.",
          deleteWarning: "ATENÇÃO: Excluir a unidade '{{name}}' apagará também o login.\n\nConfirmar exclusão?",
          deleteError: "Erro ao excluir: "
        }
      },
      mentorsTab: {
        title: "Gestão de Mentores",
        subtitle: "Diretoria e Gestores Regionales.",
        stats: {
          total: "Total",
          active: "Ativos",
          inactive: "Inativos"
        },
        newMentor: "Novo Mentor",
        searchPlaceholder: "Buscar mentor, e-mail ou telefone...",
        registered: "Mentores cadastrados ({{count}})",
        loading: "Sincronizando...",
        emptyState: "Nenhum mentor encontrado.",
        restricted: "Acesso Restrito: Apenas Administradores.",
        table: {
          name: "Mentor",
          email: "Email",
          phone: "WhatsApp",
          status: "Status",
          actions: "Ações",
          active: "ATIVO",
          inactive: "INATIVO",
          notInformed: "Adicionar nº",
          edit: "Editar Completo",
          deactivate: "Desactivar",
          activate: "Ativar",
          delete: "Excluir Definitivamente"
        },
        modal: {
          editTitle: "Editar Mentor",
          newTitle: "Novo Mentor",
          instructions: "Preencha os dados abaixo.",
          name: "Nome do Mentor",
          email: "Login (E-mail)",
          emailWarning: "Email de login não é editável.",
          country: "País",
          phone: "WhatsApp",
          phonePlaceholder: "Apenas números...",
          password: "Senha Inicial",
          status: "Status",
          statusActive: "ATIVO",
          statusInactive: "INATIVO",
          cancel: "Cancelar",
          saveEdit: "Salvar Alterações",
          saveNew: "Concluir Cadastro",
          saving: "Salvando..."
        },
        messages: {
          nameRequired: "Nome é obrigatório.",
          emailRequired: "E-mail é obrigatório.",
          passwordRequired: "Senha é obrigatória para novo mentor.",
          weakPassword: "Senha mín. 6 dígitos.",
          updated: "Mentor atualizado!",
          created: "Mentor criado com sucesso!",
          emailExists: "Este e-mail já está cadastrado.",
          invalidEmail: "E-mail inválido.",
          saveError: "Erro ao salvar mentor.",
          deleteWarning: "ATENÇÃO: Excluir o mentor '{{name}}' apagará o login dele.\nConfirmar?",
          deleted: "Mentor excluído com sucesso!",
          deleteError: "Erro ao excluir mentor.",
          statusChanged: "Mentor {{status}} com sucesso!",
          statusError: "Erro ao mudar status"
        }
      },
      teachersTab: {
        title: "Gestão de Professores",
        subtitle: "Controle de base e vínculos com as unidades.",
        stats: {
          total: "TOTAL",
          active: "ATIVOS",
          inactive: "INATIVOS"
        },
        newLinkBtn: "+ NOVO VÍNCULO",
        fixEmailsBtn: "CORRIGIR E-MAILS",
        searchPlaceholder: "Buscar por nome, telefone ou e-mail...",
        filterCountry: {
          all: "Todos os Países"
        },
        emptyState: "Nenhum professor encontrado.",
        loadMoreData: "Carregando dados consome leituras. Use com sabedoria.",
        load10: "Carregar +10",
        load50: "Carregar +50",
        loadAll: "Carregar Todos",
        table: {
          status: "STATUS",
          teacher: "PROFESSOR",
          contact: "CONTATO",
          units: "UNIDADES VINCULADAS",
          actions: "AÇÕES",
          active: "ATIVO",
          inactive: "INATIVO",
          notInformed: "Não informado",
          noLinks: "Sem vínculos",
          edit: "Editar",
          delete: "Excluir"
        },
        verifyModal: {
          title: "Adicionar Professor",
          desc: "Verifique se o professor já existe na rede.",
          emailLabel: "E-mail do Professor",
          emailPlaceholder: "professor@email.com",
          foundTitle: "Professor Encontrado!",
          linkToUnit: "Vincular a qual unidade?",
          select: "Selecione...",
          confirmLink: "Confirmar Vínculo",
          cancel: "Cancelar",
          registerNew: "Não encontrado? Cadastrar Novo"
        },
        formModal: {
          editTitle: "Editar Professor",
          newTitle: "Novo Professor",
          desc: "Preencha os dados e clique em salvar.",
          loginEmail: "E-MAIL (LOGIN FIXO)",
          fullName: "NOME COMPLETO",
          namePlaceholder: "Nome do Professor",
          country: "PAÍS",
          whatsapp: "WHATSAPP *",
          phonePlaceholder: "DDD + Número",
          status: "STATUS",
          statusActive: "ATIVO",
          statusInactive: "INATIVO",
          defaultPassNote: "Senha padrão será",
          autoLink: "VINCULAR AUTOMATICAMENTE A:",
          select: "Selecione...",
          cancel: "CANCELAR",
          saveEdit: "SALVAR ALTERAÇÕES",
          saveNew: "CONCLUIR CADASTRO",
          saving: "SALVANDO..."
        },
        messages: {
          invalidEmail: "E-mail inválido.",
          verifyError: "Erro na verificação.",
          selectUnit: "Selecione uma unidade.",
          alreadyLinked: "Este professor já está vinculado a esta unidade.",
          linkedSuccess: "Vinculado com sucesso!",
          linkError: "Erro ao vincular.",
          nameRequired: "Nome obrigatório",
          duplicateWarning: "⚠️ ATENÇÃO: Já existe professor cadastrado com o nome '{{name}}'.\n\nE-mail(s) cadastrado(s): {{emails}}\n\nTem certeza que é outra pessoa?",
          updated: "Professor atualizado com sucesso!",
          created: "Professor criado com sucesso!",
          emailExists: "E-mail já cadastrado no Auth.",
          saveError: "Erro ao salvar professor.",
          removeLinkConfirm: "Remover o professor desta unidade?",
          removeLinkError: "Erro ao remover vínculo",
          deleteConfirm: "ATENÇÃO: Excluir {{name}}?\nIsso removerá ele de TODAS as unidades.\n\nConfirmar?",
          deleteError: "Erro ao excluir",
          fixConfirm: "⚠️ ATENÇÃO: Isso vai varrer todo o banco de dados e converter os e-mails dos professores para minúsculo.\n\nDeseja continuar?",
          fixSuccess: "SUCESSO! {{count}} professores foram corrigidos para minúsculo.",
          fixError: "Erro ao corrigir base. Verifique o console."
        }
      }
    }
  },
  'es-AR': {
    translation: {
      login: {
        subtitle: "Gestión de Colectivas",
        emailLabel: "Usuario / Correo",
        emailPlaceholder: "tu@correo.com",
        passwordLabel: "Contraseña",
        passwordPlaceholder: "••••••••",
        button: "INGRESAR AL SISTEMA",
        loading: "Accediendo...",
        forgotPassword: "¿Olvidaste tu contraseña?",
        support: "Contacta al soporte",
        version: "v2.5.0 • Pratique Fitness"
      },
      errors: {
        invalidCredential: "Correo o contraseña incorrectos.",
        userNotFound: "Usuario no encontrado.",
        wrongPassword: "Contraseña incorrecta.",
        tooManyRequests: "Demasiados intentos. Inténtalo más tarde.",
        userDisabled: "Cuenta desactivada. Habla con el soporte.",
        default: "Error de acceso. Inténtalo de nuevo."
      },
      layout: {
        menu: "Menú",
        title: "Gestión Pratique",
        loading: "Cargando..."
      },
      menu: {
        dashboard: "Centro de Resultados",
        finance: "Finanzas y Tesorería",
        import: "Motor de Ingestión",
        settings: "Gestión Corporativa",
        logout: "Salir"
      },
      dashboard: {
        title: "Centro de Resultados",
        billing: "Facturación",
        enrollments: "Inscripciones",
        activeConsultants: "Consultores Activos",
        unitsWithSales: "Unidades con Ventas"
      },
      sidebar: {
        brandSubtitle: "Gestión de Colectivas",
        sections: {
          principal: "Principal",
          operacional: "Operativo",
          gestao: "Gestión"
        },
        items: {
          inicio: "Inicio",
          cronograma: "Cronograma",
          linkAluno: "Enlace del Alumno",
          validacaoDiaria: "Validación Diaria",
          validacaoColetiva: "Validación Colectiva",
          performanceFinanceira: "Rendimiento Financiero",
          relatorios: "Reportes",
          configuracoes: "Configuraciones"
        }
      },
      home: {
        greeting: {
          morning: "Buenos días",
          afternoon: "Buenas tardes",
          night: "Buenas noches"
        },
        roles: {
          admin: "Administrador",
          professor: "Profesor",
          mentor: "Mentor",
          unidade: "Unidad"
        },
        systemOnline: "Sistema en Línea",
        cardDefaults: {
          access: "Acceder"
        },
        cards: {
          reports: {
            title: "Informe Gerencial",
            subtitle: "Rendimiento Financiero",
            revenueYesterday: "INGRESOS DE AYER",
            monthlyForecast: "PREVISIÓN MENSUAL",
            footer: "Ver Detalles",
            monthlyEstimate: "Estimación Mensual (Est.)"
          },
          schedule: {
            title: "Cronograma",
            subtitle: "Grilla de clases",
            footer: "Ver Grilla Completa",
            next: "Próxima",
            unit: "Unidad",
            teacher: "Profesor",
            noMoreClasses: "No hay más clases hoy",
            defaultModality: "Clase Grupal",
            defaultTeacher: "Instructor"
          },
          validation: {
            title: "Validación Diaria",
            subtitle: "CONTROL DE ASISTENCIA",
            resolveNow: "Resolver Ahora",
            history: "Historial",
            classes: "Clases",
            pending: "Pendientes",
            allValidated: "¡Todo Validado!"
          },
          monitoring: {
            title: "Monitoreo de Validación",
            subtitle: "Estado de Ayer",
            footer: "Ver Ranking",
            status: {
              goalMet: "Meta Alcanzada",
              highAdhesion: "Alta Adhesión",
              attention: "ATENCIÓN",
              critical: "Crítico",
              excellent: "EXCELENTE",
              inProgress: "EN CURSO"
            },
            validatedOf: "{{validated}} de {{total}} validadas"
          },
          pratiquePlay: {
            title: "PRATIQUE PLAY",
            subtitle: "MÚSICA PARA CLASES",
            footer: "Acceder a Play",
            insideLine1: "PLAYLISTS DE",
            insideLine2: "CLASES"
          },
          linkAluno: {
            title: "ENLACE DEL ALUMNO",
            subtitle: "ACCESO EXTERNO",
            footer: "Abrir Portal",
            insideLine1: "PORTAL DE",
            insideLine2: "ALUMNOS"
          },
          settings: {
            title: "Configuración",
            subtitle: "Panel Administrativo",
            footer: "Gestionar",
            units: "Unidades",
            mods: "Mods",
            profs: "Profs"
          }
        }
      },
      publicSchedule: {
        title: "Grilla de Horarios",
        location: "Ubicación",
        clearFilter: "Limpiar Filtro",
        all: "Todas",
        searchPlaceholder: "Buscar unidad o clase...",
        searchIn: "Buscar en {{state}}...",
        classesFound: "Clases Encontradas",
        viewGrid: "VER GRILLA",
        unitsAvailable: "Unidades Disponibles",
        noUnitsFound: "No se encontró ninguna unidad.",
        tryChangeFilter: "Intenta cambiar el término o limpiar el filtro.",
        developedBy: "Desarrollado por Pratique Fitness",
        back: "Volver",
        printAdjustment: "Ajuste de Impresión",
        printAuto: "Automático",
        printAutoDesc: "El sistema decide",
        printCompact: "Compactar",
        printCompactDesc: "Para grillas grandes",
        printExpand: "Expandir",
        printExpandDesc: "Para grillas pequeñas",
        emptyGrid: "Grilla vacía.",
        defaultTeacher: "Instructor",
        days: {
          Segunda: "Lunes",
          Terça: "Martes",
          Quarta: "Miércoles",
          Quinta: "Jueves",
          Sexta: "Viernes",
          Sábado: "Sábado",
          Domingo: "Domingo"
        }
      },
      schedulePage: {
        title: "Agenda de Clases",
        subtitle: "Gestión de Grilla y Horarios",
        subtitleReadOnly: "Consulta los horarios de todas las unidades",
        closedBadge: "Cerrada",
        closedClassTitle: "Clase Cerrada (Solo Historial)",
        activeClassTitle: "Clase Activa",
        filters: {
          state: "Provincia",
          allStates: "Todas las Provincias",
          unit: "Unidad",
          allUnits: "Seleccione...",
          searchInGrid: "Filtrar en esta grilla",
          searchEverywhere: "Buscar Modalidad en todas las unidades",
          searchPlaceholderInGrid: "Ej: Spinning...",
          searchPlaceholderEverywhere: "Ej: Escribe 'Pilates' para ver dónde hay..."
        },
        buttons: {
          showHistory: "Ver Finalizadas",
          hideHistory: "Ocultar Finalizadas",
          add: "Agregar"
        },
        placeholders: {
          startSearchTitle: "Comienza tu búsqueda",
          startSearchDesc: "Selecciona una Unidad para ver el calendario o escribe una Modalidad para buscar en todas.",
          resultsFor: "Resultados para",
          noClassesFound: "No se encontró ninguna clase con este nombre.",
          emptyGrid: "La grilla actual está vacía. Intenta hacer clic en 'Ver Finalizadas'.",
          noClassesInUnit: "No hay clases registradas en esta unidad.",
          createFirstClass: "Crear primera clase"
        },
        modal: {
          newTitle: "CREAR NUEVA CLASE",
          editTitle: "EDITAR CLASE",
          modality: "Modalidad",
          teacher: "Profesor Titular",
          time: "Horario",
          value: "Valor Hora/Clase",
          daysOfWeek: "Días de la Semana",
          startDate: "Clase Registrada a partir de",
          endDate: "Finalizar Permanentemente en",
          cancel: "Cancelar",
          save: "Guardar",
          delete: "Eliminar",
          saveEdit: "Guardar Cambios",
          selectUnitAlert: "Seleccione la unidad",
          noTeacherLinked: "Ninguno vinculado"
        },
        splitModal: {
          title: "Alteración de Grilla",
          desc: "Has cambiado datos importantes de la clase. ¿Cómo deseas que el sistema aplique estos cambios en la base de datos?",
          recommendedBadge: "RECOMENDADO (Preserva el Pasado)",
          newPhaseTitle: "Crear Nueva Fase",
          newPhaseDesc: "Cierra la clase antigua de forma invisible y crea la nueva. Ningún reporte o asistencia pasada se perderá. Ideal para cambio de horarios, días o profesores.",
          startDateLabel: "LA NUEVA CONFIGURACIÓN EMPIEZA A VALER EL DÍA:",
          applyChange: "Aplicar Cambio",
          or: "O",
          directFixTitle: "Corregir Error de Escritura",
          directFixDesc: "Reemplaza los datos directamente. Atención: Esto altera el nombre del profesor y horarios en el pasado. Úsalo solo si la clase fue registrada incorrectamente justo ahora.",
          justReplace: "Solo Reemplazar Datos",
          backToForm: "Volver al formulario",
          selectDateAlert: "Selecciona la fecha exacta en la que la nueva configuración empieza a valer."
        },
        alerts: {
          fillRequired: "❌ Completa todos los campos obligatorios.",
          invalidDates: "❌ La fecha de finalización no puede ser anterior a la fecha de inicio.",
          deleteConfirm: "🗑️ PAPELERA INTELIGENTE:\n\n¿Deseas ocultar esta clase de la grilla? Será removida de la vista de todos, pero el historial y la base de datos se preservarán (Soft Delete).",
          deleteError: "Error al enviar la clase a la papelera.",
          saveError: "Error al guardar."
        }
      },
      reports: {
        title: "Inteligencia Financiera",
        subtitle: "Panel Ejecutivo de Nómina y Ocupación",
        filters: {
          day: "DÍA",
          month: "MES",
          period: "PERÍODO",
          export: "Exportar",
          advanced: "Filtros Avanzados (Selección Múltiple)",
          clear: "Limpiar Filtros",
          country: "País",
          state: "Provincia",
          mentor: "Mentor",
          unit: "Unidad",
          modality: "Modalidad",
          teacher: "Profesor",
          shift: "Turno"
        },
        kpis: {
          vaultActivated: "Caja Fuerte Activada",
          vaultDesc: "Para mantener la velocidad del sistema, seleccione al menos un Filtro Avanzado para desbloquear la inteligencia financiera.",
          payrollSummary: "Resumen de Nómina",
          totalToPay: "Total a Pagar en el Período",
          operationalEngine: "Motor Operativo",
          completedClasses: "Clases Realizadas",
          canceledClasses: "Clases Canceladas",
          avgClassValue: "Valor Medio P/ Clase",
          gridHealth: "Salud de la Grilla",
          occupancyRate: "Tasa de Ocupación",
          vacancyRate: "Tasa de Vacancia",
          avgStudents: "Promedio de Alumnos"
        },
        table: {
          summary: "Resumen de Nómina",
          detailed: "Detallado",
          unit: "UNIDAD (PAÍS/PROV)",
          modality: "MODALIDAD",
          time: "HORARIO",
          teacher: "PROFESOR",
          completed: "REALIZADAS",
          canceled: "CANCELADAS",
          avgStudentsCol: "PROM ALUMNOS",
          occupancyCol: "TASA OCUPACIÓN",
          classValue: "VALOR CLASE",
          toReceive: "A RECIBIR",
          noData: "NO SE ENCONTRARON DATOS PARA EL FILTRO ACTUAL."
        },
        buttons: {
          load20: "CARGAR +20",
          load50: "CARGAR +50",
          loadAll: "VER TODOS"
        }
      },
      settingsPage: {
        loadingModule: "Cargando módulo...",
        restrictedAccess: {
          title: "Acceso Restringido",
          desc: "Esta área es exclusiva para gestión."
        },
        title: "Panel de Configuración",
        subtitle: {
          unidade: "Gestiona la plantilla de profesores de tu unidad.",
          default: "Gestiona los registros globales y parámetros del sistema."
        },
        tabs: {
          unidades: "Unidades",
          mentores: "Mentores",
          professores: "Profesores",
          modalidades: "Modalidades",
          feriados: "Feriados",
          pratiquePlay: "Pratique Play",
          backup: "Copia de Seguridad"
        }
      },
      unitsTab: {
        title: "Gestión de Unidades",
        subtitle: "{{count}} unidades registradas",
        searchPlaceholder: "Buscar unidad, provincia...",
        newUnit: "+ Nueva Unidad",
        table: {
          status: "Estado",
          unit: "Unidad",
          location: "Ubicación",
          phone: "Teléfono",
          responsible: "Responsable",
          actions: "Acciones",
          active: "ACTIVA",
          inactive: "INACTIVA",
          notInformed: "No informado",
          you: "Tú",
          edit: "Editar",
          delete: "Eliminar"
        },
        emptyState: "No se encontró ninguna unidad.",
        modal: {
          editTitle: "Editar Unidad",
          newTitle: "Nueva Unidad",
          location: "Ubicación",
          country: "País",
          state: "Provincia",
          select: "Seleccione...",
          unitName: "Nombre de la Unidad",
          unitNamePlaceholder: "Ej: Centro",
          phone: "Teléfono WhatsApp",
          phonePlaceholder: "Código + Número",
          mentor: "Mentor",
          status: "Estado",
          statusActive: "Activa",
          statusInactive: "Inactiva",
          access: "Acceso Automático",
          generatedCreds: "Credenciales generadas:",
          login: "Usuario",
          loginWaiting: "Esperando nombre...",
          password: "Contraseña",
          accessWarning: "* El usuario se crea automáticamente. La contraseña se puede cambiar después.",
          cancel: "Cancelar",
          saveEdit: "Guardar Cambios",
          saveNew: "Crear Unidad",
          saving: "Guardando..."
        },
        messages: {
          nameRequired: "El nombre es obligatorio.",
          stateRequired: "Seleccione una provincia.",
          mentorRequired: "El mentor es obligatorio.",
          invalidEmail: "Correo inválido.",
          weakPassword: "Contraseña mín. 6 caracteres.",
          updated: "¡Unidad actualizada!",
          created: "¡Unidad y Acceso creados!",
          emailExists: "El correo ya existe.",
          permissionDenied: "Error de permisos.",
          deleteWarning: "ATENCIÓN: Eliminar la unidad '{{name}}' también borrará su acceso.\n\n¿Confirmar eliminación?",
          deleteError: "Error al eliminar: "
        }
      },
      mentorsTab: {
        title: "Gestión de Mentores",
        subtitle: "Directiva y Gestores Regionales.",
        stats: {
          total: "Total",
          active: "Activos",
          inactive: "Inactivos"
        },
        newMentor: "Nuevo Mentor",
        searchPlaceholder: "Buscar mentor, correo o teléfono...",
        registered: "Mentores registrados ({{count}})",
        loading: "Sincronizando...",
        emptyState: "No se encontró ningún mentor.",
        restricted: "Acceso Restringido: Solo Administradores.",
        table: {
          name: "Mentor",
          email: "Correo",
          phone: "WhatsApp",
          status: "Status",
          actions: "Acciones",
          active: "ACTIVO",
          inactive: "INACTIVO",
          notInformed: "Añadir nº",
          edit: "Editar Completo",
          deactivate: "Desactivar",
          activate: "Activar",
          delete: "Eliminar Definitivamente"
        },
        modal: {
          editTitle: "Editar Mentor",
          newTitle: "Nuevo Mentor",
          instructions: "Complete los datos a continuación.",
          name: "Nombre del Mentor",
          email: "Login (Correo)",
          emailWarning: "El correo de acceso no es editable.",
          country: "País",
          phone: "WhatsApp",
          phonePlaceholder: "Solo números...",
          password: "Contraseña Inicial",
          status: "Estado",
          statusActive: "ACTIVO",
          statusInactive: "INACTIVO",
          cancel: "Cancelar",
          saveEdit: "Guardar Cambios",
          saveNew: "Completar Registro",
          saving: "Guardando..."
        },
        messages: {
          nameRequired: "El nombre es obligatorio.",
          emailRequired: "El correo es obligatorio.",
          passwordRequired: "La contraseña es obligatoria para el nuevo mentor.",
          weakPassword: "Contraseña mín. 6 dígitos.",
          updated: "¡Mentor actualizado!",
          created: "¡Mentor creado con éxito!",
          emailExists: "Este correo ya está registrado.",
          invalidEmail: "Correo inválido.",
          saveError: "Error al guardar el mentor.",
          deleteWarning: "ATENCIÓN: Eliminar al mentor '{{name}}' también borrará su acceso.\n¿Confirmar?",
          deleted: "¡Mentor eliminado con éxito!",
          deleteError: "Error al eliminar el mentor.",
          statusChanged: "¡Mentor {{status}} con éxito!",
          statusError: "Error al cambiar el estado."
        }
      },
      teachersTab: {
        title: "Gestión de Profesores",
        subtitle: "Control de base y vínculos con las unidades.",
        stats: {
          total: "TOTAL",
          active: "ACTIVOS",
          inactive: "INACTIVOS"
        },
        newLinkBtn: "+ NUEVO VÍNCULO",
        fixEmailsBtn: "CORREGIR CORREOS",
        searchPlaceholder: "Buscar por nombre, teléfono o correo...",
        filterCountry: {
          all: "Todos los Países"
        },
        emptyState: "No se encontró ningún profesor.",
        loadMoreData: "Cargar datos consume lecturas. Úsalo con sabiduría.",
        load10: "Cargar +10",
        load50: "Cargar +50",
        loadAll: "Cargar Todos",
        table: {
          status: "ESTADO",
          teacher: "PROFESOR",
          contact: "CONTACTO",
          units: "UNIDADES VINCULADAS",
          actions: "ACCIONES",
          active: "ACTIVO",
          inactive: "INACTIVO",
          notInformed: "No informado",
          noLinks: "Sin vínculos",
          edit: "Editar",
          delete: "Eliminar"
        },
        verifyModal: {
          title: "Agregar Profesor",
          desc: "Verifica si el profesor ya existe en la red.",
          emailLabel: "Correo del Profesor",
          emailPlaceholder: "profesor@correo.com",
          foundTitle: "¡Profesor Encontrado!",
          linkToUnit: "¿Vincular a qué unidad?",
          select: "Seleccione...",
          confirmLink: "Confirmar Vínculo",
          cancel: "Cancelar",
          registerNew: "¿No encontrado? Registrar Nuevo"
        },
        formModal: {
          editTitle: "Editar Profesor",
          newTitle: "Nuevo Profesor",
          desc: "Completa los datos y haz clic en guardar.",
          loginEmail: "CORREO (ACCESO FIJO)",
          fullName: "NOMBRE COMPLETO",
          namePlaceholder: "Nombre del Profesor",
          country: "PAÍS",
          whatsapp: "WHATSAPP *",
          phonePlaceholder: "Código + Número",
          status: "ESTADO",
          statusActive: "ACTIVO",
          statusInactive: "INACTIVO",
          defaultPassNote: "La contraseña por defecto será",
          autoLink: "VINCULAR AUTOMÁTICAMENTE A:",
          select: "Seleccione...",
          cancel: "CANCELAR",
          saveEdit: "GUARDAR CAMBIOS",
          saveNew: "COMPLETAR REGISTRO",
          saving: "GUARDANDO..."
        },
        messages: {
          invalidEmail: "Correo inválido.",
          verifyError: "Error en la verificación.",
          selectUnit: "Seleccione una unidad.",
          alreadyLinked: "Este profesor ya está vinculado a esta unidad.",
          linkedSuccess: "¡Vinculado con éxito!",
          linkError: "Error al vincular.",
          nameRequired: "El nombre es obligatorio",
          duplicateWarning: "⚠️ ATENCIÓN: Ya existe un profesor registrado con el nombre '{{name}}'.\n\nCorreo(s) registrado(s): {{emails}}\n\n¿Estás seguro de que es otra persona?",
          updated: "¡Profesor actualizado con éxito!",
          created: "¡Profesor creado con éxito!",
          emailExists: "El correo ya está registrado en Auth.",
          saveError: "Error al guardar el profesor.",
          removeLinkConfirm: "¿Remover al profesor de esta unidad?",
          removeLinkError: "Error al remover el vínculo",
          deleteConfirm: "ATENCIÓN: ¿Eliminar a {{name}}?\nEsto lo removerá de TODAS las unidades.\n\n¿Confirmar?",
          deleteError: "Error al eliminar",
          fixConfirm: "⚠️ ATENCIÓN: Esto barrerá toda la base de datos y convertirá los correos de los profesores a minúsculas.\n\n¿Desea continuar?",
          fixSuccess: "¡ÉXITO! {{count}} profesores fueron corregidos a minúsculas.",
          fixError: "Error al corregir la base. Verifique la consola."
        }
      }
    }
  },
  'en-US': {
    translation: {
      login: {
        subtitle: "Group Classes Management",
        emailLabel: "Username / Email",
        emailPlaceholder: "your@email.com",
        passwordLabel: "Password",
        passwordPlaceholder: "••••••••",
        button: "LOGIN TO SYSTEM",
        loading: "Accessing...",
        forgotPassword: "Forgot your password?",
        support: "Contact support",
        version: "v2.5.0 • Pratique Fitness"
      },
      errors: {
        invalidCredential: "Incorrect email or password.",
        userNotFound: "User not found.",
        wrongPassword: "Incorrect password.",
        tooManyRequests: "Too many attempts. Try again later.",
        userDisabled: "Account disabled. Contact support.",
        default: "Access error. Try again."
      },
      layout: {
        menu: "Menu",
        title: "Pratique Management",
        loading: "Loading..."
      },
      menu: {
        dashboard: "Results Center",
        finance: "Finance & Treasury",
        import: "Ingestion Engine",
        settings: "Corporate Management",
        logout: "Logout"
      },
      dashboard: {
        title: "Results Center",
        billing: "Billing",
        enrollments: "Enrollments",
        activeConsultants: "Active Consultants",
        unitsWithSales: "Units with Sales"
      },
      sidebar: {
        brandSubtitle: "Group Classes Management",
        sections: {
          principal: "Main",
          operacional: "Operational",
          gestao: "Management"
        },
        items: {
          inicio: "Home",
          cronograma: "Schedule",
          linkAluno: "Student Link",
          validacaoDiaria: "Daily Validation",
          validacaoColetiva: "Group Validation",
          performanceFinanceira: "Financial Performance",
          relatorios: "Reports",
          configuracoes: "Settings"
        }
      },
      home: {
        greeting: {
          morning: "Good morning",
          afternoon: "Good afternoon",
          night: "Good evening"
        },
        roles: {
          admin: "Administrator",
          professor: "Teacher",
          mentor: "Mentor",
          unidade: "Unit"
        },
        systemOnline: "System Online",
        cardDefaults: {
          access: "Access"
        },
        cards: {
          reports: {
            title: "Management Report",
            subtitle: "Financial Performance",
            revenueYesterday: "YESTERDAY'S REVENUE",
            monthlyForecast: "MONTHLY FORECAST",
            footer: "View Details",
            monthlyEstimate: "Monthly Estimate (Est.)"
          },
          schedule: {
            title: "Schedule",
            subtitle: "Class Grid",
            footer: "View Full Grid",
            next: "Next",
            unit: "Unit",
            teacher: "Teacher",
            noMoreClasses: "No more classes today",
            defaultModality: "Group Class",
            defaultTeacher: "Instructor"
          },
          validation: {
            title: "Daily Validation",
            subtitle: "ATTENDANCE CONTROL",
            resolveNow: "Resolve Now",
            history: "History",
            classes: "Classes",
            pending: "Pending",
            allValidated: "All Validated!"
          },
          monitoring: {
            title: "Validation Monitoring",
            subtitle: "Yesterday's Status",
            footer: "View Ranking",
            status: {
              goalMet: "Goal Met",
              highAdhesion: "High Adhesion",
              attention: "ATTENTION",
              critical: "Critical",
              excellent: "EXCELLENT",
              inProgress: "IN PROGRESS"
            },
            validatedOf: "{{validated}} of {{total}} validated"
          },
          pratiquePlay: {
            title: "PRATIQUE PLAY",
            subtitle: "CLASS MUSIC",
            footer: "Access Play",
            insideLine1: "GROUP CLASS",
            insideLine2: "PLAYLISTS"
          },
          linkAluno: {
            title: "STUDENT LINK",
            subtitle: "EXTERNAL ACCESS",
            footer: "Open Portal",
            insideLine1: "STUDENT",
            insideLine2: "PORTAL"
          },
          settings: {
            title: "Settings",
            subtitle: "Admin Panel",
            footer: "Manage",
            units: "Units",
            mods: "Mods",
            profs: "Profs"
          }
        }
      },
      publicSchedule: {
        title: "Schedule Board",
        location: "Location",
        clearFilter: "Clear Filter",
        all: "All",
        searchPlaceholder: "Search unit or class...",
        searchIn: "Search in {{state}}...",
        classesFound: "Classes Found",
        viewGrid: "VIEW GRID",
        unitsAvailable: "Available Units",
        noUnitsFound: "No units found.",
        tryChangeFilter: "Try changing the term or clearing the filter.",
        developedBy: "Developed by Pratique Fitness",
        back: "Back",
        printAdjustment: "Print Adjustment",
        printAuto: "Automatic",
        printAutoDesc: "System decides",
        printCompact: "Compact",
        printCompactDesc: "For large grids",
        printExpand: "Expand",
        printExpandDesc: "For small grids",
        emptyGrid: "Empty grid.",
        defaultTeacher: "Instructor",
        days: {
          Segunda: "Monday",
          Terça: "Tuesday",
          Quarta: "Wednesday",
          Quinta: "Thursday",
          Sexta: "Friday",
          Sábado: "Saturday",
          Domingo: "Sunday"
        }
      },
      schedulePage: {
        title: "Class Schedule",
        subtitle: "Grid and Schedule Management",
        subtitleReadOnly: "Check the schedules of all units",
        closedBadge: "Closed",
        closedClassTitle: "Closed Class (History Only)",
        activeClassTitle: "Active Class",
        filters: {
          state: "State",
          allStates: "All States",
          unit: "Unit",
          allUnits: "Select...",
          searchInGrid: "Filter in this grid",
          searchEverywhere: "Search Modality in all units",
          searchPlaceholderInGrid: "Ex: Spinning...",
          searchPlaceholderEverywhere: "Ex: Type 'Pilates' to see where it's available..."
        },
        buttons: {
          showHistory: "View Finished",
          hideHistory: "Hide Finished",
          add: "Add"
        },
        placeholders: {
          startSearchTitle: "Start your search",
          startSearchDesc: "Select a Unit to view the calendar or type a Modality to search all.",
          resultsFor: "Results for",
          noClassesFound: "No classes found with this name.",
          emptyGrid: "The current grid is empty. Try clicking 'View Finished'.",
          noClassesInUnit: "No classes registered in this unit.",
          createFirstClass: "Create first class"
        },
        modal: {
          newTitle: "CREATE NEW CLASS",
          editTitle: "EDIT CLASS",
          modality: "Modality",
          teacher: "Main Teacher",
          time: "Time",
          value: "Class/Hour Rate",
          daysOfWeek: "Days of the Week",
          startDate: "Class Registered starting from",
          endDate: "Permanently End on",
          cancel: "Cancel",
          save: "Save",
          delete: "Delete",
          saveEdit: "Save Changes",
          selectUnitAlert: "Select a unit",
          noTeacherLinked: "None linked"
        },
        splitModal: {
          title: "Grid Alteration",
          desc: "You have changed important data for this class. How do you want the system to apply these changes to the database?",
          recommendedBadge: "RECOMMENDED (Preserves the Past)",
          newPhaseTitle: "Create New Phase",
          newPhaseDesc: "Invisibly closes the old class and creates the new one. No past reports or attendance will be lost. Ideal for changing schedules, days, or teachers.",
          startDateLabel: "THE NEW CONFIGURATION TAKES EFFECT ON:",
          applyChange: "Apply Change",
          or: "OR",
          directFixTitle: "Correct Typing Error",
          directFixDesc: "Replaces the data directly. Attention: This alters the teacher's name and schedules in the past. Use only if the class was registered incorrectly just now.",
          justReplace: "Just Replace Data",
          backToForm: "Back to form",
          selectDateAlert: "Select the exact date the new configuration takes effect."
        },
        alerts: {
          fillRequired: "❌ Fill in all required fields.",
          invalidDates: "❌ The end date cannot be earlier than the start date.",
          deleteConfirm: "🗑️ SMART TRASH:\n\nDo you want to hide this class from the grid? It will be removed from everyone's view, but the history and database will be preserved (Soft Delete).",
          deleteError: "Error sending the class to the trash.",
          saveError: "Error saving."
        }
      },
      reports: {
        title: "Financial Intelligence",
        subtitle: "Payroll and Occupancy Executive Dashboard",
        filters: {
          day: "DAY",
          month: "MONTH",
          period: "PERIOD",
          export: "Export",
          advanced: "Advanced Filters (Multi-Select)",
          clear: "Clear Filters",
          country: "Country",
          state: "State",
          mentor: "Mentor",
          unit: "Unit",
          modality: "Modality",
          teacher: "Teacher",
          shift: "Shift"
        },
        kpis: {
          vaultActivated: "Report Vault Activated",
          vaultDesc: "To maintain system speed, select at least one Advanced Filter to unlock financial intelligence.",
          payrollSummary: "Payroll Summary",
          totalToPay: "Total to Pay in Filtered Period",
          operationalEngine: "Operational Engine",
          completedClasses: "Completed Classes",
          canceledClasses: "Canceled Classes",
          avgClassValue: "Avg Value Per Class",
          gridHealth: "Grid Health",
          occupancyRate: "Occupancy Rate",
          vacancyRate: "Vacancy Rate",
          avgStudents: "Average Students"
        },
        table: {
          summary: "Payroll Summary",
          detailed: "Detailed",
          unit: "UNIT (COUNTRY/STATE)",
          modality: "MODALITY",
          time: "TIME",
          teacher: "TEACHER",
          completed: "COMPLETED",
          canceled: "CANCELED",
          avgStudentsCol: "AVG STUDENTS",
          occupancyCol: "OCCUPANCY RATE",
          classValue: "CLASS RATE",
          toReceive: "TO RECEIVE",
          noData: "NO DATA FOUND FOR CURRENT FILTER."
        },
        buttons: {
          load20: "LOAD +20",
          load50: "LOAD +50",
          loadAll: "VIEW ALL"
        }
      },
      settingsPage: {
        loadingModule: "Loading module...",
        restrictedAccess: {
          title: "Restricted Access",
          desc: "This area is exclusive for management."
        },
        title: "Settings Panel",
        subtitle: {
          unidade: "Manage your unit's teacher roster.",
          default: "Manage global records and system parameters."
        },
        tabs: {
          unidades: "Units",
          mentores: "Mentors",
          professores: "Teachers",
          modalidades: "Modalities",
          feriados: "Holidays",
          pratiquePlay: "Pratique Play",
          backup: "Backup"
        }
      },
      unitsTab: {
        title: "Units Management",
        subtitle: "{{count}} registered units",
        searchPlaceholder: "Search unit, state...",
        newUnit: "+ New Unit",
        table: {
          status: "Status",
          unit: "Unit",
          location: "Location",
          phone: "Phone",
          responsible: "Responsible",
          actions: "Actions",
          active: "ACTIVE",
          inactive: "INACTIVE",
          notInformed: "Not informed",
          you: "You",
          edit: "Edit",
          delete: "Delete"
        },
        emptyState: "No units found.",
        modal: {
          editTitle: "Edit Unit",
          newTitle: "New Unit",
          location: "Location",
          country: "Country",
          state: "State",
          select: "Select...",
          unitName: "Unit Name",
          unitNamePlaceholder: "Ex: Downtown",
          phone: "WhatsApp Phone",
          phonePlaceholder: "Area Code + Number",
          mentor: "Mentor",
          status: "Status",
          statusActive: "Active",
          statusInactive: "Inactive",
          access: "Automatic Access",
          generatedCreds: "Generated credentials:",
          login: "Login",
          loginWaiting: "Waiting for name...",
          password: "Password",
          accessWarning: "* Login is created automatically. Password can be changed later.",
          cancel: "Cancel",
          saveEdit: "Save Changes",
          saveNew: "Create Unit",
          saving: "Saving..."
        },
        messages: {
          nameRequired: "Unit name is required.",
          stateRequired: "Select a state.",
          mentorRequired: "Mentor is required.",
          invalidEmail: "Invalid e-mail.",
          weakPassword: "Password min. 6 chars.",
          updated: "Unit updated!",
          created: "Unit and Access created!",
          emailExists: "E-mail already exists.",
          permissionDenied: "Permission denied.",
          deleteWarning: "ATTENTION: Deleting unit '{{name}}' will also delete its login.\n\nConfirm deletion?",
          deleteError: "Error deleting: "
        }
      },
      mentorsTab: {
        title: "Mentors Management",
        subtitle: "Board and Regional Managers.",
        stats: {
          total: "Total",
          active: "Active",
          inactive: "Inactive"
        },
        newMentor: "New Mentor",
        searchPlaceholder: "Search mentor, email or phone...",
        registered: "Registered mentors ({{count}})",
        loading: "Synchronizing...",
        emptyState: "No mentor found.",
        restricted: "Restricted Access: Administrators Only.",
        table: {
          name: "Mentor",
          email: "Email",
          phone: "WhatsApp",
          status: "Status",
          actions: "Actions",
          active: "ACTIVE",
          inactive: "INACTIVE",
          notInformed: "Add nº",
          edit: "Full Edit",
          deactivate: "Deactivate",
          activate: "Activate",
          delete: "Delete Permanently"
        },
        modal: {
          editTitle: "Edit Mentor",
          newTitle: "New Mentor",
          instructions: "Fill in the details below.",
          name: "Mentor's Name",
          email: "Login (Email)",
          emailWarning: "Login email cannot be edited.",
          country: "Country",
          phone: "WhatsApp",
          phonePlaceholder: "Numbers only...",
          password: "Initial Password",
          status: "Status",
          statusActive: "ACTIVE",
          statusInactive: "INACTIVE",
          cancel: "Cancel",
          saveEdit: "Save Changes",
          saveNew: "Complete Registration",
          saving: "Saving..."
        },
        messages: {
          nameRequired: "Name is required.",
          emailRequired: "Email is required.",
          passwordRequired: "Password is required for new mentor.",
          weakPassword: "Password min. 6 digits.",
          updated: "Mentor updated!",
          created: "Mentor created successfully!",
          emailExists: "This email is already registered.",
          invalidEmail: "Invalid email.",
          saveError: "Error saving mentor.",
          deleteWarning: "WARNING: Deleting mentor '{{name}}' will also delete their login.\nConfirm?",
          deleted: "Mentor deleted successfully!",
          deleteError: "Error deleting mentor.",
          statusChanged: "Mentor {{status}} successfully!",
          statusError: "Error changing status."
        }
      },
      teachersTab: {
        title: "Teachers Management",
        subtitle: "Base control and links with units.",
        stats: {
          total: "TOTAL",
          active: "ACTIVE",
          inactive: "INACTIVE"
        },
        newLinkBtn: "+ NEW LINK",
        fixEmailsBtn: "FIX EMAILS",
        searchPlaceholder: "Search by name, phone or email...",
        filterCountry: {
          all: "All Countries"
        },
        emptyState: "No teachers found.",
        loadMoreData: "Loading data consumes reads. Use wisely.",
        load10: "Load +10",
        load50: "Load +50",
        loadAll: "Load All",
        table: {
          status: "STATUS",
          teacher: "TEACHER",
          contact: "CONTACT",
          units: "LINKED UNITS",
          actions: "ACTIONS",
          active: "ACTIVE",
          inactive: "INACTIVE",
          notInformed: "Not informed",
          noLinks: "No links",
          edit: "Edit",
          delete: "Delete"
        },
        verifyModal: {
          title: "Add Teacher",
          desc: "Check if the teacher already exists in the network.",
          emailLabel: "Teacher's Email",
          emailPlaceholder: "teacher@email.com",
          foundTitle: "Teacher Found!",
          linkToUnit: "Link to which unit?",
          select: "Select...",
          confirmLink: "Confirm Link",
          cancel: "Cancel",
          registerNew: "Not found? Register New"
        },
        formModal: {
          editTitle: "Edit Teacher",
          newTitle: "New Teacher",
          desc: "Fill in the details and click save.",
          loginEmail: "EMAIL (FIXED LOGIN)",
          fullName: "FULL NAME",
          namePlaceholder: "Teacher's Name",
          country: "COUNTRY",
          whatsapp: "WHATSAPP *",
          phonePlaceholder: "Area Code + Number",
          status: "STATUS",
          statusActive: "ACTIVE",
          statusInactive: "INACTIVE",
          defaultPassNote: "Default password will be",
          autoLink: "AUTOMATICALLY LINK TO:",
          select: "Select...",
          cancel: "CANCEL",
          saveEdit: "SAVE CHANGES",
          saveNew: "COMPLETE REGISTRATION",
          saving: "SAVING..."
        },
        messages: {
          invalidEmail: "Invalid e-mail.",
          verifyError: "Verification error.",
          selectUnit: "Select a unit.",
          alreadyLinked: "This teacher is already linked to this unit.",
          linkedSuccess: "Linked successfully!",
          linkError: "Error linking.",
          nameRequired: "Name is required",
          duplicateWarning: "⚠️ WARNING: A teacher with the name '{{name}}' already exists.\n\nRegistered email(s): {{emails}}\n\nAre you sure it is someone else?",
          updated: "Teacher updated successfully!",
          created: "Teacher created successfully!",
          emailExists: "Email already registered in Auth.",
          saveError: "Error saving teacher.",
          removeLinkConfirm: "Remove teacher from this unit?",
          removeLinkError: "Error removing link",
          deleteConfirm: "WARNING: Delete {{name}}?\nThis will remove them from ALL units.\n\nConfirm?",
          deleteError: "Error deleting",
          fixConfirm: "⚠️ WARNING: This will scan the entire database and convert all teacher emails to lowercase.\n\nDo you wish to continue?",
          fixSuccess: "SUCCESS! {{count}} teachers were corrected to lowercase.",
          fixError: "Error fixing database. Check the console."
        }
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem('idioma_pratique') || 'pt-BR', 
    fallbackLng: 'pt-BR',
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;