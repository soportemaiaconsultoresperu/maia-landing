// URL del Google Apps Script (Web App)
// Reemplaza esto con la URL real cuando la tengas
// export const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwqA411-QUD5xnL4nJiC0BHWMTp5Qsp_ebDTSMbe24q_hV39FQQF_b2BzAJJ8SX_f_9zg/exec';
export const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxChjOsML3etbRHgT4Dvm7UwrigFoQdU6u8ea8p1ezPNBlJW6mtriIK4UW033ZlNPL2DQ/exec';
export function setupDemoForm(formId: string, projectName: string) {
  const form = document.getElementById(formId) as HTMLFormElement;
  const successMessage = document.getElementById('formSuccess');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    if (!submitBtn) return;
    
    const originalText = submitBtn.innerText;
    submitBtn.innerText = 'Enviando...';
    submitBtn.disabled = true;

    try {
      const data = {
        name: (document.getElementById('name') as HTMLInputElement)?.value || '',
        email: (document.getElementById('email') as HTMLInputElement)?.value || '',
        company: (document.getElementById('company') as HTMLInputElement)?.value || '',
        technicians: (document.getElementById('technicians') as HTMLSelectElement)?.value || '',
        message: (document.getElementById('message') as HTMLTextAreaElement)?.value || '',
        project: projectName
      };

      await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        }
      });

      form.classList.add('hidden');
      if (successMessage) successMessage.classList.remove('hidden');
    } catch (error) {
      console.error('Error enviando formulario:', error);
      alert('Hubo un error enviando la solicitud. Por favor intenta de nuevo.');
      submitBtn.innerText = originalText;
      submitBtn.disabled = false;
    }
  });
}
